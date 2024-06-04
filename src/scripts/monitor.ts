import { parse as parsePlist } from '@plist/parse';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: '.env.local' });

function getEnvVar(str: string): string {
  const val = process.env[str];
  if (!val) throw new Error(`${str} env var not set!`);
  return val;
}

const SOURCE_ID = getEnvVar('SOURCE_ID');
const VERSION_ID = getEnvVar('VERSION_ID');
const INGEST_HOST = getEnvVar('INGEST_HOST');

// -------------------------------------------------------------------------------------------------
// getDockerStats

interface IDockerContainerStats {
  id: string;
  name: string;
  cpuPercent: number;
}

// -------------------------------------------------------------------------------------------------
// isDockerAvailable

async function isDockerAvailable(): Promise<boolean> {
  const { execaCommand }: typeof import('execa') = await eval('import(\'execa\')');
  const output = await execaCommand('which docker');

  return !!output.stdout.trim();
}

// -------------------------------------------------------------------------------------------------
// getDockerStats

async function getDockerStats(): Promise<IDockerContainerStats[]> {
  const { execa }: typeof import('execa') = await eval('import(\'execa\')');
  const output = await execa('docker', ['stats', '--no-stream', '--format', '"{{ json . }}"']);

  return output.stdout.trim()
    .split('\n')
    .map(line => JSON.parse(line.substring(1, line.length-1)))
    .map(container => ({
      id: container.ID,
      name: container.Name,
      cpuPercent: parseFloat(container.CPUPerc.substring(0, container.CPUPerc.length - 1)),
    }));
}

// -------------------------------------------------------------------------------------------------
// measureAndPush

async function measureAndPush(getValues: () => Promise<{ voltage: number; amperage: number; wattage: number; cpuPercent: number }>) {
  const dockerAvailable = await isDockerAvailable();
  console.log('dockerAvailable', dockerAvailable);

  setInterval(() => {
    (async () => {
      try {
        const config: {
          dockerContainers: Record<string, string>;
        } = await fs.readJSON(path.resolve(__dirname, '../../config.json'));

        const [
          { voltage, amperage, wattage, cpuPercent },
          dockerContainerStats,
        ] = await Promise.all([
          getValues(),
          dockerAvailable ? getDockerStats() : undefined,
        ]);
        console.log(new Date().toISOString(), voltage, amperage, wattage, cpuPercent);

        await fetch(`${INGEST_HOST}/ingest`, {
          method: 'POST',
          body: JSON.stringify({
            sourceId: SOURCE_ID,
            versionId: VERSION_ID,
            ts: Date.now(),
            voltage,
            amperage,
            wattage,
            cpuPercent,
            docker: dockerContainerStats ? {
              cpuPercent: dockerContainerStats.reduce((sum, c) => sum + c.cpuPercent, 0),
              containers: dockerContainerStats.filter(container => !!config.dockerContainers[container.name]).map(container => ({
                ...container,
                versionId: config.dockerContainers[container.name],
              })),
            } : undefined,
          }),
        });
      } catch (error) {
        console.error(error);
      }
    })();
  }, 1000);
}

// -------------------------------------------------------------------------------------------------
// monitor

async function monitor() {
  const { platform, arch } = process;

  switch (platform) {
    case 'darwin': {
      await measureAndPush(async () => {
        const { execaCommand }: typeof import('execa') = await eval('import(\'execa\')');

        // 11789/1000*(18446744073709550265-2^64)/1000

        const batteryCmd = await execaCommand('ioreg -rw0 -a -c AppleSmartBattery');
        const batteryCmdOutput = (parsePlist(batteryCmd.stdout) as Record<string, any>)[0];
        const voltage = batteryCmdOutput.Voltage as number;
        const amperage = batteryCmdOutput.Amperage as number;
        const wattage = voltage/1000 * amperage/1000;

        // const cpuPercentCmd = await execaCommand('ps -A -o %cpu | awk \'{s+=$1} END {print s}\'');
        const cpuPercentCmd = execSync('ps -A -o %cpu | awk \'{s+=$1} END {print s}\'')
        const cpuPercent = parseFloat(cpuPercentCmd.toString());

        return { voltage, amperage, wattage, cpuPercent: cpuPercent };
      });
    }
  }
}

monitor();
