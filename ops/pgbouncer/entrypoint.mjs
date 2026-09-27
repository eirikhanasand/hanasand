import { chmod, writeFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'

const username = process.env.DB_USER || 'hanasand'
const password = process.env.DB_PASSWORD
const database = process.env.DB || 'hanasand'
const directHost = process.env.DB_DIRECT_HOST || '127.0.0.1'
const directPort = Number(process.env.DB_DIRECT_PORT || 18504)
if (!/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(username)) throw new Error('Invalid DB_USER for PgBouncer')
if (!password) throw new Error('DB_PASSWORD is required for PgBouncer')
if (username !== 'hanasand') throw new Error('PgBouncer auth setup requires DB_USER=hanasand')

const authSetup = `CREATE SCHEMA IF NOT EXISTS pgbouncer AUTHORIZATION hanasand;
REVOKE ALL ON SCHEMA pgbouncer FROM PUBLIC;
CREATE OR REPLACE FUNCTION pgbouncer.get_auth(p_username text)
RETURNS TABLE(username text, password text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
    SELECT rolname::text, rolpassword::text
    FROM pg_catalog.pg_authid
    WHERE rolname = p_username AND rolcanlogin
$function$;
REVOKE ALL ON FUNCTION pgbouncer.get_auth(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA pgbouncer TO hanasand;
GRANT EXECUTE ON FUNCTION pgbouncer.get_auth(text) TO hanasand;`
const setup = spawnSync('psql', [
    '-X', '-w', '--set=ON_ERROR_STOP=1', '-h', directHost, '-p', String(directPort),
    '-U', username, '-d', database, '--command', authSetup,
], { env: { ...process.env, PGPASSWORD: password }, stdio: 'inherit' })
if (setup.error) throw setup.error
if (setup.status !== 0) throw new Error(`PgBouncer auth setup failed with status ${setup.status}`)

const quote = value => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
const authFile = '/run/pgbouncer/userlist.txt'
await writeFile(authFile, `${quote(username)} ${quote(password)}\n`, { mode: 0o600 })
await chmod(authFile, 0o600)

const child = spawn('pgbouncer', ['/etc/pgbouncer/pgbouncer.ini'], { stdio: 'inherit' })
child.on('error', error => { throw error })
child.on('exit', (code, signal) => {
    process.exit(signal ? 1 : code ?? 1)
})
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal))
