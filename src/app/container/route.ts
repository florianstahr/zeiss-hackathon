import { NextRequest } from 'next/server';
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGO_URI as string);

export async function GET(req: NextRequest) {
  const db = client.db('zeiss_hackathon');
  const data = await db.collection('data').aggregate([
    {
      '$unwind': {
        'path': '$docker.containers',
      }
    },
    {
      '$addFields': {
        wattage: {
          $multiply: [
            '$wattage',
            {
              $divide: ['$docker.containers.cpuPercent', '$cpuPercent']

            }
          ]
        }
      }
    }
  ]).toArray();

  return Response.json(data);
}
