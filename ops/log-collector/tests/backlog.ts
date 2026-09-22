import { Commands, Store } from '../core';
import { auditEvents } from '../sources';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'collector-memory-'));
const producer = `async function run() { for(let i=0;i<100000;i++){const row='type=SYSCALL msg=audit(1790000000.123:'+i+'): success=yes exe="/usr/bin/echo"\\n'+'type=EXECVE msg=audit(1790000000.123:'+i+'): argc=2 a0="echo" a1="'+'x'.repeat(2048)+'"\\n'; if(!process.stdout.write(row)) await new Promise(r=>process.stdout.once('drain',r)); }} run();`;
async function main() {
  let count = 0, bytes = 0;
  const commands = new Commands(new Store(root));
  async function* records() { for await (const line of commands.stream([process.execPath, '-e', producer], { timeout: 120 })) { bytes += Buffer.byteLength(line); yield line; } }
  try { for await (const _event of auditEvents(records(), { host: 'memory-fixture' })) count++; }
  finally { rmSync(root, { recursive: true, force: true }); }
  const peakRssBytes = process.resourceUsage().maxRSS * 1024;
  console.log(JSON.stringify({ count, bytes, peakRssBytes }));
  if (count !== 100000 || bytes < 200000000 || peakRssBytes >= 250000000) process.exit(1);
}
void main();
