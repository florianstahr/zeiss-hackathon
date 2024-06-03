import { parse as parsePlist } from '@plist/parse';

async function monitor() {
  const { execaCommand }: typeof import('execa') = await eval('import(\'execa\')');

  // 11789/1000*(18446744073709550265-2^64)/1000

  const batteryCmd = await execaCommand('ioreg -rw0 -a -c AppleSmartBattery');
  const batteryCmdOutput = (parsePlist(batteryCmd.stdout) as Record<string, any>)[0];
  const voltage = batteryCmdOutput.Voltage as number;
  const amperage = batteryCmdOutput.Amperage as number;
  const wattage = voltage/1000 * amperage/1000;

  console.log(voltage, amperage, wattage);
}

monitor();
