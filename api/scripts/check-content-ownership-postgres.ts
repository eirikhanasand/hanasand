import assert from 'node:assert/strict'
import { withTransaction, closeDatabase } from '../src/utils/db.ts'
import { contentOrganizationSchema } from '../src/utils/db/contentOrganizationSchema.ts'

// All fixtures and schema changes are rolled back, including when an assertion fails.
const rollback = new Error('rollback successful ownership checks')
try {
    await withTransaction(async query => {
        await query('SET LOCAL statement_timeout = \'15s\'')
        await query('CREATE SCHEMA content_ownership_rollback_check')
        await query('SET LOCAL search_path = content_ownership_rollback_check, public')
        await query(`CREATE TABLE users(id TEXT PRIMARY KEY);
            CREATE TABLE organizations(id TEXT PRIMARY KEY, status TEXT);
            CREATE TABLE organization_members(organization_id TEXT, user_id TEXT, status TEXT, role TEXT);
            CREATE TABLE share(id TEXT PRIMARY KEY, owner TEXT, content TEXT);
            CREATE TABLE thoughts(id SERIAL PRIMARY KEY, created_by TEXT);
            CREATE TABLE notes(id TEXT PRIMARY KEY, owner_id TEXT, content TEXT);`)
        await query(contentOrganizationSchema)
        await query(`INSERT INTO users VALUES ('editor'), ('reader'), ('outsider'), ('removed');
            INSERT INTO organizations VALUES ('hanasand', 'active'), ('other', 'active'), ('archived', 'archived');
            INSERT INTO organization_members VALUES ('hanasand','editor','active','editor'), ('hanasand','reader','active','reader'),
                ('hanasand','removed','removed','owner'), ('archived','editor','active','owner');
            INSERT INTO share(id, owner, content, organization_id) VALUES ('public','anonymous','unchanged','hanasand');
            INSERT INTO notes(id, owner_id, content, organization_id) VALUES ('organization','outsider','private','hanasand'), ('personal','outsider','mine',NULL);
            INSERT INTO article_ownership(id, organization_id) VALUES ('example.md','hanasand');`)
        for (const [org, user, edit, allowed] of [
            ['hanasand', 'editor', true, true], ['hanasand', 'reader', false, true], ['hanasand', 'reader', true, false],
            ['hanasand', 'outsider', false, false], ['hanasand', 'removed', true, false], ['archived', 'editor', true, false],
            ['other', 'editor', false, false],
        ] as const) {
            assert.equal((await query('SELECT content_organization_access($1,$2,$3) allowed', [org, user, edit])).rows[0].allowed, allowed)
        }
        const readNotes = (id: string) => query(`SELECT id FROM notes WHERE CASE WHEN organization_id IS NULL THEN owner_id = $1
            ELSE content_organization_access(organization_id, $1) END ORDER BY id`, [id])
        assert.deepEqual((await readNotes('outsider')).rows.map(row => row.id), ['personal'])
        assert.deepEqual((await readNotes('reader')).rows.map(row => row.id), ['organization'])
        for (const [id, count] of [['outsider', 0], ['reader', 0], ['removed', 0], ['editor', 1]] as const) {
            const result = await query(`UPDATE notes SET content = 'updated' WHERE id = 'organization'
                AND CASE WHEN organization_id IS NULL THEN owner_id = $1 ELSE content_organization_access(organization_id, $1, TRUE) END RETURNING id`, [id])
            assert.equal(result.rows.length, count)
        }
        assert.equal((await query('SELECT content FROM share WHERE id=\'public\'')).rows[0].content, 'unchanged')
        assert.equal((await query('SELECT count(*)::int n FROM article_ownership WHERE organization_id=$1', ['hanasand'])).rows[0].n, 1)
        throw rollback
    })
} catch (error) {
    if (error !== rollback) throw error
    console.log('PostgreSQL ownership, membership, private notes, and public content checks passed; all fixtures rolled back.')
} finally {
    await closeDatabase()
}
