import { fs, dirname, Store, Commands, Config, iso } from './core';
export function configure(host: string, credentialPath: string, path = '/etc/hanasand/log-collector.json') {
  if (!/^[a-zA-Z0-9_./-]+$/.test(host)) throw new Error('Invalid host');
  const credential = JSON.parse(fs.readFileSync(credentialPath === '-' ? 0 : credentialPath, 'utf8'));
  if (typeof credential.LOG_INGEST_TOKEN !== 'string' || credential.LOG_INGEST_TOKEN.length < 32) throw new Error('Invalid ingestion credential');
  const config: Config = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : { host, start: iso() };
  Object.assign(config, { host, url: 'https://api.hanasand.com/api/logs/ingest', token: credential.LOG_INGEST_TOKEN });
  fs.mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); new Store(dirname(path)).save(path.slice(dirname(path).length + 1), config);
}
export function retention(path = '/etc/audit/auditd.conf', available?: number) {
  let text = fs.readFileSync(path, 'utf8');
  const values = Object.fromEntries([...text.matchAll(/^\s*([a-z_]+)\s*=\s*([^#\n]+)/gm)].map(m => [m[1], m[2].trim()]));
  if (values.max_log_file_action?.toUpperCase() !== 'ROTATE') return { changed: false, reason: 'Existing non-rotating security policy preserved' };
  const oldSize = Number(values.max_log_file || 8), oldCount = Number(values.num_logs || 5), size = Math.max(100, oldSize), count = Math.max(oldCount, Math.ceil(2000 / size));
  if (![oldSize, oldCount].every(value => Number.isInteger(value) && value >= 0)) throw new Error('Invalid audit retention configuration');
  if (oldSize * oldCount >= 2000) return { changed: false, max_log_file: oldSize, num_logs: oldCount };
  const disk = available === undefined ? fs.statfsSync(dirname(values.log_file || '/var/log/audit/audit.log')) : undefined;
  if ((available ?? disk!.bavail * disk!.bsize) < (size * count - oldSize * oldCount) * 1024 ** 2 + 2 * 1024 ** 3) throw new Error('Insufficient disk headroom for 2GB audit retention');
  for (const [key, value] of Object.entries({ max_log_file: size, num_logs: count })) {
    const pattern = new RegExp('^(\\s*' + key + '\\s*=\\s*)\\d+', 'm'); text = pattern.test(text) ? text.replace(pattern, (_, prefix: string) => prefix + value) : text + '\n' + key + ' = ' + value + '\n';
  }
  const backup = path + '.before-hanasand-retention'; if (!fs.existsSync(backup)) fs.copyFileSync(path, backup, fs.constants.COPYFILE_EXCL);
  const temporary = path + '.hanasand-pending', stat = fs.statSync(path); fs.writeFileSync(temporary, text, { mode: stat.mode & 0o777 }); fs.chmodSync(temporary, stat.mode & 0o777);
  if (process.geteuid?.() === 0) fs.chownSync(temporary, stat.uid, stat.gid);
  fs.renameSync(temporary, path); return { changed: true, max_log_file: size, num_logs: count };
}
export async function applyRetention() { const result = retention(); if (result.changed) await new Commands(new Store()).run(['auditctl', '--signal', 'reload']); console.log(JSON.stringify(result)); }
