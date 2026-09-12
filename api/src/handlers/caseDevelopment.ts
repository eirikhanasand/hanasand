import { randomBytes, randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { encryptRepoSecret, decryptRepoSecret } from '#utils/ai/repoCredentials.ts'
import { developmentEntries, repositoryUrl, validGitSignature } from '#utils/caseDevelopment.ts'

type Query = { organizationId?: string, caseId?: string, offset?: string }
const scope = `(r.organization_id IS NOT DISTINCT FROM $2::text AND
    ((r.organization_id IS NULL AND r.owner_id = $1) OR EXISTS (
        SELECT 1 FROM organizations o JOIN organization_members m ON m.organization_id = o.id
        WHERE o.id = r.organization_id AND o.status = 'active' AND m.user_id = $1 AND m.status = 'active')))`

async function access(req: FastifyRequest<{ Querystring: Query }>, res: FastifyReply, manage = false) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) { res.status(401).send({ error: 'Unauthorized.' }); return null }
    const organizationId = req.query.organizationId || null
    if (organizationId) {
        const result = await run(`SELECT m.role FROM organizations o JOIN organization_members m ON m.organization_id = o.id
            WHERE o.id = $1 AND o.status = 'active' AND m.user_id = $2 AND m.status = 'active'`, [organizationId, auth.id])
        if (!result.rows.length || manage && !['owner', 'admin'].includes(result.rows[0].role)) { res.status(403).send({ error: 'Organization administrators manage repository integrations.' }); return null }
    }
    return { owner: auth.id, organizationId }
}

export async function getCaseDevelopment(req: FastifyRequest<{ Querystring: Query }>, res: FastifyReply) {
    const auth = await access(req, res)
    if (!auth) return
    const { caseId, offset = '0' } = req.query
    if (!caseId || !/^[a-zA-Z0-9_-]{1,200}$/.test(caseId) || !/^\d{1,7}$/.test(offset)) return res.status(400).send({ error: 'Invalid case or page.' })
    const result = await run(`SELECT d.*, r.repository_url, r.provider FROM case_development d JOIN case_repositories r ON r.id = d.repository_id
        WHERE ${scope} AND d.case_references @> ARRAY[$3]::text[]
        ORDER BY d.updated_at DESC, d.repository_id, d.kind, d.external_id LIMIT 51 OFFSET $4`, [auth.owner, auth.organizationId, caseId, Number(offset)])
    return res.send({ items: result.rows.slice(0, 50), hasMore: result.rows.length > 50 })
}

export async function getCaseRepositories(req: FastifyRequest<{ Querystring: Query }>, res: FastifyReply) {
    const auth = await access(req, res)
    if (!auth) return
    const result = await run(`SELECT r.id, r.provider, r.repository_url, r.last_received_at, r.last_warning FROM case_repositories r WHERE ${scope} ORDER BY r.created_at`, [auth.owner, auth.organizationId])
    return res.send({ items: result.rows })
}

export async function postCaseRepository(req: FastifyRequest<{ Querystring: Query, Body: { provider?: string, repositoryUrl?: string } }>, res: FastifyReply) {
    const auth = await access(req, res, true)
    if (!auth) return
    if (!req.body || !['github', 'forgejo', 'gitlab'].includes(req.body.provider || '') || typeof req.body.repositoryUrl !== 'string' || req.body.repositoryUrl.length > 2000) return res.status(400).send({ error: 'Choose a provider and repository URL.' })
    let url: string
    try { url = repositoryUrl(req.body.repositoryUrl) } catch { return res.status(400).send({ error: 'Use the HTTPS repository page URL.' }) }
    const secret = randomBytes(32).toString('hex')
    const id = randomUUID()
    const encrypted = encryptRepoSecret(secret)
    const result = await run(`INSERT INTO case_repositories (id, owner_id, organization_id, provider, repository_url, secret_encrypted)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING id`, [id, auth.owner, auth.organizationId, req.body.provider!, url, encrypted])
    if (!result.rows.length) return res.status(409).send({ error: 'This repository is already connected. Disconnect it before replacing its webhook secret.' })
    return res.status(201).header('Cache-Control', 'no-store').send({ id, secret, webhookPath: `/api/cases/repository-events/${id}` })
}

export async function deleteCaseRepository(req: FastifyRequest<{ Querystring: Query, Params: { id: string } }>, res: FastifyReply) {
    const auth = await access(req, res, true)
    if (!auth) return
    if (!/^[a-f0-9-]{36}$/.test(req.params.id)) return res.status(400).send({ error: 'Invalid integration.' })
    const result = await run(`DELETE FROM case_repositories r WHERE ${scope} AND r.id = $3 RETURNING id`, [auth.owner, auth.organizationId, req.params.id])
    return res.status(result.rows.length ? 200 : 404).send({ ok: Boolean(result.rows.length) })
}

// Encapsulated parser preserves exactly the bytes providers signed without changing other API routes.
export async function caseRepositoryWebhooks(fastify: FastifyInstance) {
    fastify.removeContentTypeParser('application/json')
    fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body))
    fastify.post<{ Params: { id: string }, Body: string }>('/cases/repository-events/:id', { bodyLimit: 5 * 1024 * 1024 }, async (req, res) => {
        if (!/^[a-f0-9-]{36}$/.test(req.params.id) || typeof req.body !== 'string') return res.status(400).send({ error: 'Invalid webhook.' })
        const result = await run('SELECT * FROM case_repositories WHERE id = $1', [req.params.id])
        const repository = result.rows[0]
        if (!repository || !validGitSignature(repository.provider, req.body, req.headers, decryptRepoSecret(repository.secret_encrypted))) return res.status(401).send({ error: 'Invalid webhook signature.' })
        const event = String(req.headers['x-github-event'] || req.headers['x-forgejo-event'] || req.headers['x-gitea-event'] || req.headers['x-gitlab-event'] || '')
        if (event === 'ping') return res.send({ ok: true })
        let entries
        let payload
        try {
            payload = JSON.parse(req.body)
            entries = developmentEntries(repository.provider, event, payload, repository.repository_url)
        } catch { return res.status(400).send({ error: 'Invalid repository event.' }) }
        // One atomic statement: retries cannot duplicate links; older deliveries cannot overwrite newer MR state.
        await run(`INSERT INTO case_development (repository_id, kind, external_id, title, url, author, state, branch, updated_at, case_references)
            SELECT $1, x.kind, x."externalId", x.title, x.url, x.author, x.state, x.branch, x."updatedAt", x."references"
            FROM jsonb_to_recordset($2::jsonb) AS x(kind text, "externalId" text, title text, url text, author text, state text, branch text, "updatedAt" timestamptz, "references" text[])
            WHERE cardinality(x."references") > 0 OR EXISTS (SELECT 1 FROM case_development d WHERE d.repository_id = $1 AND d.kind = x.kind AND d.external_id = x."externalId")
            ON CONFLICT (repository_id, kind, external_id) DO UPDATE SET title = EXCLUDED.title, state = EXCLUDED.state,
                author = EXCLUDED.author, branch = EXCLUDED.branch, updated_at = EXCLUDED.updated_at, case_references = EXCLUDED.case_references
            WHERE EXCLUDED.updated_at >= case_development.updated_at`, [repository.id, JSON.stringify(entries)])
        const truncated = Number(payload.total_commits_count || payload.size || 0) > (payload.commits?.length || 0)
        await run('UPDATE case_repositories SET last_received_at = NOW(), last_warning = $2 WHERE id = $1', [repository.id, truncated ? 'Provider truncated this push. Some commit references may be missing; deliver the omitted commits again.' : null])
        return res.send({ ok: true, processed: entries.length })
    })
}
