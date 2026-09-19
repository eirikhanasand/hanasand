import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import matter from 'gray-matter'
import { withTransaction, closeDatabase } from '../src/utils/db.ts'
import { ARTICLES_DIR } from '../src/utils/git/git.ts'

// Deliberately one-off: new anonymous content must not be silently transferred later.
const organizationId = '3e735e7b-4d7f-444d-9806-231fa26cfcec'
const migrationId = 'hanasand-ownerless-content-2026-09-19'
const apply = process.argv.includes('--apply')

try {
    const articleIds: string[] = []
    for (const file of await readdir(ARTICLES_DIR, { withFileTypes: true })) {
        if (!file.isFile() || !file.name.endsWith('.md')) continue
        const { data } = matter(await readFile(join(ARTICLES_DIR, file.name), 'utf8'))
        // Authorship is not ownership. Preserve explicit legacy ownership, if any.
        if ([data.owner, data.owner_id, data.ownerId, data.organization_id, data.organizationId].some(value => typeof value === 'string' && value.trim() && value !== 'anonymous')) continue
        articleIds.push(file.name)
    }
    const result = await withTransaction(async query => {
        await query('SET LOCAL lock_timeout = \'10s\'')
        await query('SET LOCAL statement_timeout = \'30s\'')
        await query('SELECT pg_advisory_xact_lock(hashtext($1))', [migrationId])
        const org = (await query('SELECT id, name FROM organizations WHERE id = $1 AND slug = \'hanasand\' AND status = \'active\' FOR SHARE', [organizationId])).rows[0]
        if (!org) throw new Error('The expected active Hanasand organization was not found.')
        const prior = await query('SELECT id, context FROM system_events WHERE request_id = $1 AND event_type = $2', [migrationId, 'content.organization_assigned'])
        if (prior.rows.length) return { alreadyApplied: true, audit: prior.rows[0] }
        await query('LOCK TABLE share, thoughts, notes, article_ownership IN SHARE ROW EXCLUSIVE MODE')
        const shares = (await query('SELECT id FROM share WHERE organization_id IS NULL AND btrim(owner) IN (\'\', \'anonymous\') ORDER BY id')).rows.map(row => row.id)
        const thoughts = (await query('SELECT id::text FROM thoughts WHERE organization_id IS NULL AND btrim(created_by) IN (\'\', \'anonymous\') ORDER BY id')).rows.map(row => row.id)
        const notes = (await query('SELECT id FROM notes WHERE organization_id IS NULL AND btrim(owner_id) IN (\'\', \'anonymous\') ORDER BY id')).rows.map(row => row.id)
        const articles = (await query('SELECT unnest($1::text[]) AS id EXCEPT SELECT id FROM article_ownership', [articleIds])).rows.map(row => row.id)
        const items = { shares, thoughts, articles, notes }
        if (!apply) return { dryRun: true, organization: org, items }
        await query('UPDATE share SET organization_id = $1 WHERE id = ANY($2::text[])', [organizationId, shares])
        await query('UPDATE thoughts SET organization_id = $1 WHERE id::text = ANY($2::text[])', [organizationId, thoughts])
        await query('UPDATE notes SET organization_id = $1 WHERE id = ANY($2::text[])', [organizationId, notes])
        await query('INSERT INTO article_ownership (id, organization_id) SELECT unnest($1::text[]), $2', [articles, organizationId])
        const audit = await query(`INSERT INTO system_events
            (event_type, source, object_type, organization_id, request_id, reason, context)
            VALUES ('content.organization_assigned', 'migration', 'content', $1, $2,
                'Assigned existing ownerless content to Hanasand; public visibility and authorship unchanged.', $3::jsonb) RETURNING id`,
        [organizationId, migrationId, JSON.stringify({ items, previousOrganizationId: null })])
        return { applied: true, organization: org, items, auditId: audit.rows[0].id }
    })
    console.log(JSON.stringify(result, null, 2))
} finally {
    await closeDatabase()
}
