import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import pg from 'pg'

// This check deliberately connects only to a disposable local test instance.
const client = new pg.Client({ host: '127.0.0.1', port: 55439, database: 'postgres', user: process.env.USER })
await client.connect()
await client.query('BEGIN')
try {
    await client.query(`CREATE SCHEMA role_test; SET search_path TO role_test;
        CREATE TABLE organizations(id text PRIMARY KEY, status text);
        CREATE TABLE organization_members(organization_id text, user_id text, role text DEFAULT 'member' CHECK(role IN ('owner','admin','member','viewer')), status text);
        CREATE TABLE organization_invites(id text, role text DEFAULT 'member' CHECK(role IN ('admin','member','viewer')));
        CREATE TABLE vms(name text, owner text, created_by text, access_users jsonb);
        INSERT INTO organizations VALUES ('org','active');
        INSERT INTO organization_members VALUES ('org','owner','owner','active'),('org','admin','admin','active'),('org','member','member','active'),('org','viewer','viewer','active');
        INSERT INTO organization_invites VALUES ('pending','member'),('viewer','viewer'),('admin','admin');`)
    const query = (sql: string, values?: unknown[]) => client.query(sql, values)
    mock.module('#db', () => ({ default: query, withTransaction: async (work: (run: typeof query) => unknown) => work(query) }))
    const migrate = (await import('../src/utils/db/organizationRolesSchema.ts')).default
    await migrate()
    await migrate()
    assert.deepEqual((await query('SELECT role FROM organization_members ORDER BY user_id')).rows.map(row => row.role), ['admin', 'reader', 'owner', 'reader'])
    assert.equal((await query('SELECT COUNT(*) FROM organization_invites WHERE role=\'reader\'')).rows[0].count, '2')
    await query('INSERT INTO organization_members VALUES (\'org\',\'editor\',\'editor\',\'active\'); INSERT INTO organization_invites(id) VALUES (\'default\')')
    assert.equal((await query('SELECT role FROM organization_invites WHERE id=\'default\'')).rows[0].role, 'reader')
    await (await import('../src/utils/db/vmOrganizationSchema.ts')).default()
    await query('INSERT INTO vms VALUES (\'org-vm\',\'member\',\'member\',\'["viewer"]\',\'org\'), (\'personal\',\'member\',\'member\',\'["viewer"]\',NULL)')
    for (const role of ['owner', 'admin', 'editor', 'member', 'viewer']) {
        const row = (await query('SELECT vm_user_has_access(\'org-vm\',$1) AS read, vm_user_can_manage(\'org-vm\',$1) AS write', [role])).rows[0]
        assert.equal(row.read, true)
        assert.equal(row.write, ['owner','admin'].includes(role))
    }
    assert.equal((await query('SELECT vm_user_can_manage(\'personal\',\'viewer\') AS allowed')).rows[0].allowed, true)
    await query('UPDATE organization_members SET status=\'removed\' WHERE user_id=\'owner\'')
    assert.equal((await query('SELECT vm_user_can_manage(\'org-vm\',\'owner\') AS allowed')).rows[0].allowed, false)
    await query(`CREATE TABLE agent_automations(owner_id text, organization_id text, action_type text, target_url text, model_name text, notification_destinations text[]);
        INSERT INTO agent_automations VALUES ('member','org','agent_prompt',NULL,NULL,'{}'),('editor','org','agent_prompt',NULL,NULL,'{}');`)
    const { automationReadScope, automationWriteScope } = await import('../src/utils/automationAccess.ts')
    for (const user of ['member', 'editor']) {
        const read = await query(`SELECT 1 FROM agent_automations a WHERE ${automationReadScope('a', '$1', '$2')}`, [false, user])
        const write = await query(`SELECT 1 FROM agent_automations a WHERE ${automationWriteScope('a', '$1', '$2')}`, [false, user])
        assert.equal(read.rows.length, 1)
        assert.equal(write.rows.length, user === 'editor' ? 1 : 0)
    }
    console.log('Role migration, invite defaults, idempotency, VM read/admin access, automation write access and removed membership passed.')
} finally {
    await client.query('ROLLBACK')
    await client.end()
}
