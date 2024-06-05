import { config } from 'dotenv';
import { MongoClient } from 'mongodb';
import { parse as parsePlist } from '@plist/parse';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'node:child_process';
import { parse as parseDate } from 'date-fns';

config({ path: '.env.local' });

const client = new MongoClient(process.env.MONGO_URI as string);
const db = client.db('zeiss_hackathon');

interface IDockerCompareTask {
  taskId: string;
  type: 'compare-docker-container-versions';
  containerName: string;
  segments: {
    name: string;
    start: string;
    end: string;
  }[];
}

interface IDevCompareTask {
  taskId: string;
  type: 'compare-dev-machines';
  segments: {
    dev: string;
    name: string;
    start: string;
    end: string;
  }[];
}

type TaskUnion = IDockerCompareTask | IDevCompareTask;

async function calc() {
  const tasks: TaskUnion[] = await fs.readJSON(path.resolve(__dirname, '../../analysis-tasks.json')).then(d => d.tasks);

  console.log('load data', tasks.length, tasks);

  const data = await db.collection('data').find().toArray();

  const insightsDB = db.collection('insights');

  await insightsDB.deleteMany({});

  console.log('data loaded', data.length, data.at(-1));

  for (const task of tasks) {
    console.log('doing', task.taskId, task.taskId);
    switch (task.type) {
      case 'compare-docker-container-versions': {
        for (const segment of task.segments) {
          const start = parseDate(segment.start, 'yyyy-MM-dd HH:mm:ss', new Date());
          const end = parseDate(segment.end, 'yyyy-MM-dd HH:mm:ss', new Date());

          let sum = 0;
          let count = 0;

          console.log('> segment', start, end);

          for (const record of data) {
            if (record.ts < start.getTime() || record.ts > end.getTime()) continue;
            const container = record.docker?.containers.find((c: any) => c.name === task.containerName);
            if (!container) continue;
            count += 1;
            sum += (container.cpuPercent/record.cpuPercent)*Math.abs(record.wattage);
          }

          const avg = count > 0 ? sum/count : 0;
          console.log('avg', task.taskId, segment.name, avg, sum, count);

          await insightsDB.insertOne({
            insightType: 'docker-container-version',
            task,
            segment,
            avg,
            sum,
            count,
          });
        }
        break;
      }
      case 'compare-dev-machines': {
        for (const segment of task.segments) {
          const start = parseDate(segment.start, 'yyyy-MM-dd HH:mm:ss', new Date());
          const end = parseDate(segment.end, 'yyyy-MM-dd HH:mm:ss', new Date());

          let sum = 0;
          let count = 0;

          console.log('> segment', start, end);

          for (const record of data) {
            if (record.ts < start.getTime() || record.ts > end.getTime()) continue;
            if (record.sourceId !== segment.dev) continue;
            count += 1;
            sum += Math.abs(record.wattage);
          }

          const avg = count > 0 ? sum/count : 0;
          console.log('dev avg', task.taskId, segment.dev, segment.name, avg, sum, count);

          await insightsDB.insertOne({
            key: `${segment.dev} ${segment.name}`,
            insightType: 'dev-segment',
            task,
            segment,
            avg,
            sum,
            count,
          });
        }

        const devs = new Set(task.segments.map(s => s.dev));

        const insights = await insightsDB.find({ 'task.taskId': task.taskId }).toArray();

        for (const dev of devs) {
          const relevantInsights = insights.filter(i => i.segment.dev === dev);

          let sum = 0;
          let count = 0;

          for (const insight of relevantInsights) {
            sum += insight.sum;
            count += insight.count;
          }

          const avg = sum/count;
          console.log('dev avg', task.taskId, dev, avg, sum, count);

          await insightsDB.insertOne({
            insightType: 'dev',
            dev,
            task,
            avg,
            sum,
            count,
          });
        }

        break;
      }
    }
  }

  console.log('finished');
  process.exit();
}

calc();
