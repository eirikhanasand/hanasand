#!/usr/bin/env bun
/** Stream support data into the paused independent store over SSH. */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

export const TABLES = ['users', 'support_tickets', 'support_messages', 'support_live_tickets', 'support_auth_sessions'] as const

function run(sql: string, restore = false) {
    const args = restore
        ? ['exec', '-i', 'hanasand-support-db', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-p', '18508', '-U', 'support', '-d', 'hanasand_support']
        : ['exec', '-i', 'hanasand_database', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'hanasand', '-d', 'hanasand']
    const result = spawnSync('docker', args, { input: sql, encoding: 'utf8', stdio: ['pipe', restore ? 'ignore' : 'inherit', 'inherit'] })
    if (result.status !== 0) throw new Error(`Support ${restore ? 'import' : 'export'} failed with exit status ${result.status}`)
    if (!restore && result.stdout) process.stdout.write(result.stdout)
}

export function exportSnapshot() {
    run(`
    BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
    WITH sessions AS (
        SELECT encode(sha256(convert_to(t.token,'UTF8')),'hex') AS token_hash, t.id AS user_id,
            LEAST(t.timestamp + CASE WHEN t.user_agent LIKE 'Hanasand Desktop/%' THEN INTERVAL '30 days' ELSE INTERVAL '24 hours' END,
                  NOW()+INTERVAL '24 hours') AS expires_at,
            json_build_object(
                'user', json_build_object('id',u.id,'name',u.name,'avatar',u.avatar,'active',u.active,'deletion_scheduled_at',u.deletion_scheduled_at),
                'roles', (SELECT json_agg(r) FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=t.id),
                'session', json_build_object('token_id',t.token_id,'id',t.id,'ip',t.ip,'user_agent',t.user_agent,'created_at',t.created_at,'timestamp',t.timestamp),
                'refreshed', json_build_object('expires_at',t.timestamp+CASE WHEN t.user_agent LIKE 'Hanasand Desktop/%' THEN INTERVAL '30 days' ELSE INTERVAL '24 hours' END)
            ) AS snapshot
        FROM tokens t JOIN users u ON u.id=t.id
        WHERE t.revoked_at IS NULL AND u.active IS TRUE AND u.deletion_scheduled_at IS NULL AND u.account_type='user'
          AND t.timestamp > NOW()-CASE WHEN t.user_agent LIKE 'Hanasand Desktop/%' THEN INTERVAL '30 days' ELSE INTERVAL '24 hours' END
          AND EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=t.id AND ur.role_id='support')
    )
    SELECT json_build_object(
        'users', COALESCE((SELECT json_agg(v) FROM (SELECT id,name FROM users WHERE id IN (
            SELECT user_id FROM support_tickets UNION SELECT sender_id FROM support_messages UNION SELECT user_id FROM sessions)) v),'[]'::json),
        'support_tickets', COALESCE((SELECT json_agg(t) FROM support_tickets t),'[]'::json),
        'support_messages', COALESCE((SELECT json_agg(m) FROM support_messages m),'[]'::json),
        'support_live_tickets', COALESCE((SELECT json_agg(l) FROM support_live_tickets l WHERE expires_at>NOW()),'[]'::json),
        'support_auth_sessions', COALESCE((SELECT json_agg(s) FROM sessions s),'[]'::json));
    COMMIT;
    `)
}

export function importSnapshot(input: string) {
    const config = JSON.parse(readFileSync('/home/ubuntu/hanasand-recovery/support.json', 'utf8'))
    if (config.SUPPORT_MAINTENANCE !== '1') throw new Error('Pause support writes before migrating')
    const data = JSON.parse(input)
    if (!data || Object.keys(data).length !== TABLES.length || TABLES.some(table => !Array.isArray(data[table])))
        throw new Error('Invalid support snapshot')
    const csv = `"${JSON.stringify(data).replaceAll('"', '""')}"\n`
    let sql = 'BEGIN; SET LOCAL standard_conforming_strings=on; CREATE TEMP TABLE support_import(document JSON);\nCOPY support_import FROM STDIN WITH (FORMAT csv);\n'
    sql += csv + '\\.\n'
    sql += "DO $$ BEGIN IF EXISTS(SELECT 1 FROM support_tickets) OR EXISTS(SELECT 1 FROM support_messages) THEN RAISE EXCEPTION 'Support destination must be empty'; END IF; END $$;\n"
    for (const table of TABLES) sql += `INSERT INTO ${table} SELECT record.* FROM support_import, json_populate_recordset(NULL::${table}, document->'${table}') AS record;\n`
    sql += 'COMMIT;\n'
    run(sql, true)
    console.log(JSON.stringify({ imported: Object.fromEntries(TABLES.map(table => [table, data[table].length])) }))
}

if (import.meta.main) {
    const action = Bun.argv[2]
    if (action === 'export' && Bun.argv.length === 3) exportSnapshot()
    else if (action === 'import' && Bun.argv.length === 3) importSnapshot(await new Response(Bun.stdin.stream()).text())
    else throw new Error('Use export on Inspur or import on OVH')
}
