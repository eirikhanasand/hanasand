import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { validateSession } from '#utils/auth/session.ts'

type ShareRow = {
    id: string
    path: string
    content: string
    git: string | null
    locked: boolean
    owner: string
    parent: string
    alias: string
    type: 'file' | 'folder'
    created_at: string
    updated_at: string
}

type ShareInput = {
    id?: string
    path?: string
    name?: string
    content?: string
    parent?: string
    type?: string
    includeTree?: boolean
}

type ShareTreeItem = {
    id: string
    name: string
    alias: string | null
    parent: string | null
} & ({
    type: 'file'
} | {
    type: 'folder'
    children: ShareTreeItem[]
})

export async function getShare(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const share = await findShare(id)
    if (!share) return res.status(404).send({ error: 'Share not found.' })
    return res.send(toShare(share))
}

export async function getShareTree(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const root = await findShare(id)
    if (!root) return res.status(404).send({ error: 'Share not found.' })
    const rows = await listSharesForRoot(root)
    return res.send(buildTree(rows, root.id))
}

export async function getUserShares(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const auth = await authenticatedUser(req)
    if (!auth || auth !== id) return res.status(401).send({ error: 'Unauthorized.' })
    const result = await run(`
        SELECT * FROM share
        WHERE owner = $1 AND COALESCE(parent, '') = ''
        ORDER BY updated_at DESC
        LIMIT 100
    `, [id])
    return res.send(result.rows.map(row => toShare(row as ShareRow)))
}

export async function getUserProjects(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const auth = await authenticatedUser(req)
    if (!auth || auth !== id) return res.status(401).send({ error: 'Unauthorized.' })

    const result = await run(`
        WITH RECURSIVE roots AS (
            SELECT *
            FROM share
            WHERE owner = $1 AND COALESCE(parent, '') = ''
            ORDER BY updated_at DESC
            LIMIT 100
        ),
        tree(root_id, id, owner, content) AS (
            SELECT id, id, owner, content
            FROM roots
            UNION ALL
            SELECT tree.root_id, child.id, child.owner, child.content
            FROM share child
            JOIN tree ON child.parent = tree.id
        )
        SELECT
            COALESCE(NULLIF(root.alias, ''), root.id) AS alias,
            root.owner,
            root.updated_at AS last_updated,
            COUNT(tree.id) AS file_count,
            COALESCE(SUM(LENGTH(tree.content)), 0) AS total_size
        FROM roots root
        JOIN tree ON tree.root_id = root.id
        GROUP BY root.id, root.alias, root.owner, root.updated_at
        ORDER BY root.updated_at DESC
    `, [id])

    return res.send(result.rows.map(row => ({
        alias: row.alias,
        owner: row.owner,
        editors: [row.owner],
        file_count: Number(row.file_count || 0),
        total_size: Number(row.total_size || 0),
        last_updated: row.last_updated,
    })))
}

export async function getProject(req: FastifyRequest, res: FastifyReply) {
    const { alias } = req.params as { alias: string }
    const root = await findShare(alias)
    if (!root) return res.status(404).send({ error: 'Project not found.' })

    const auth = await authenticatedUser(req)
    if (root.owner !== 'anonymous' && auth !== root.owner) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const rows = await listSharesForRoot(root)
    return res.send({
        share: toShare(root),
        tree: buildTree(rows, root.id),
    })
}

export async function postShare(req: FastifyRequest, res: FastifyReply) {
    const body = req.body as ShareInput ?? {}
    const id = cleanId(body.id || body.path || body.name)
    if (!id) return res.status(400).send({ error: 'Missing share id.' })
    const owner = await authenticatedUser(req) || 'anonymous'
    const type = body.type === 'folder' ? 'folder' : 'file'
    const path = body.path || body.name || id
    const alias = cleanAlias(body.name || body.path || id)
    const parent = body.parent || ''
    const content = typeof body.content === 'string' ? body.content : null
    const result = await run(`
        INSERT INTO share (id, path, content, owner, parent, alias, type, updated_at)
        VALUES ($1, $2, COALESCE($3, ''), $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
            path = EXCLUDED.path,
            content = COALESCE($3, share.content),
            owner = COALESCE(NULLIF(share.owner, ''), EXCLUDED.owner),
            parent = EXCLUDED.parent,
            alias = EXCLUDED.alias,
            type = EXCLUDED.type,
            updated_at = NOW()
        RETURNING *
    `, [id, path, content, owner, parent, alias, type])
    const share = result.rows[0] as ShareRow
    if (body.includeTree) {
        const rows = await listSharesForRoot(share)
        return res.status(201).send({ ...toShare(share), tree: buildTree(rows, share.id) })
    }
    return res.status(201).send(toShare(share))
}

export async function putShare(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const body = req.body as Partial<ShareInput & { locked?: boolean, alias?: string }> ?? {}
    const existing = await findShare(id)
    if (!existing) return res.status(404).send({ error: 'Share not found.' })
    const result = await run(`
        UPDATE share
        SET path = COALESCE($2, path),
            content = COALESCE($3, content),
            parent = COALESCE($4, parent),
            alias = COALESCE($5, alias),
            type = COALESCE($6, type),
            locked = COALESCE($7, locked),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `, [
        id,
        body.path || body.name || null,
        typeof body.content === 'string' ? body.content : null,
        body.parent ?? null,
        body.alias || (body.name || body.path ? cleanAlias(body.name || body.path || id) : null),
        body.type === 'folder' || body.type === 'file' ? body.type : null,
        typeof body.locked === 'boolean' ? body.locked : null,
    ])
    return res.send(toShare(result.rows[0] as ShareRow))
}

export async function deleteShare(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    await deleteShareTree(id)
    return res.send({ deleted: id })
}

export async function deleteProject(req: FastifyRequest, res: FastifyReply) {
    const { alias } = req.params as { alias: string }
    const root = await findShare(alias)
    if (!root) return res.status(404).send({ error: 'Project not found.' })

    const auth = await authenticatedUser(req)
    if (!auth || auth !== root.owner) return res.status(401).send({ error: 'Unauthorized.' })

    await deleteShareTree(root.id)
    return res.send({ deleted: root.alias || root.id })
}

export async function toggleShareLock(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    const result = await run('UPDATE share SET locked = NOT locked, updated_at = NOW() WHERE id = $1 RETURNING *', [id])
    const share = result.rows[0] as ShareRow | undefined
    if (!share) return res.status(404).send({ error: 'Share not found.' })
    return res.send(toShare(share))
}

async function authenticatedUser(req: FastifyRequest) {
    const token = headerValue(req.headers.authorization)?.replace(/^Bearer\s+/i, '')
    const id = headerValue(req.headers.id)
    if (!token || !id) return null
    const session = await validateSession({ id, token }).catch(() => null)
    return session?.user.id || null
}

async function findShare(id: string) {
    const result = await run('SELECT * FROM share WHERE id = $1 OR alias = $1 OR path = $1 LIMIT 1', [id])
    return result.rows[0] as ShareRow | undefined
}

async function deleteShareTree(id: string) {
    await run(`
        WITH RECURSIVE descendants AS (
            SELECT id
            FROM share
            WHERE id = $1
            UNION ALL
            SELECT child.id
            FROM share child
            JOIN descendants ON child.parent = descendants.id
        )
        DELETE FROM share
        WHERE id IN (SELECT id FROM descendants)
    `, [id])
}

async function listSharesForRoot(root: ShareRow) {
    const result = await run('SELECT * FROM share WHERE owner = $1 ORDER BY parent ASC, type DESC, path ASC', [root.owner])
    const rows = result.rows as ShareRow[]
    const descendants = new Set([root.id])
    let changed = true
    while (changed) {
        changed = false
        for (const row of rows) {
            if (row.parent && descendants.has(row.parent) && !descendants.has(row.id)) {
                descendants.add(row.id)
                changed = true
            }
        }
    }
    return rows.filter(row => descendants.has(row.id))
}

function buildTree(rows: ShareRow[], rootId: string) {
    const childrenByParent = new Map<string, ShareRow[]>()
    for (const row of rows) {
        const parent = row.parent || ''
        const children = childrenByParent.get(parent) || []
        children.push(row)
        childrenByParent.set(parent, children)
    }
    const toItem = (row: ShareRow): ShareTreeItem => row.type === 'folder'
        ? { id: row.id, name: row.path, alias: row.alias, parent: row.parent || null, type: 'folder', children: (childrenByParent.get(row.id) || []).map(toItem) }
        : { id: row.id, name: row.path, alias: row.alias, parent: row.parent || null, type: 'file' }
    const root = rows.find(row => row.id === rootId)
    return root ? [toItem(root)] : []
}

function toShare(row: ShareRow) {
    const words = row.content.trim() ? row.content.trim().split(/\s+/).length : 0
    return {
        id: row.id,
        path: row.path,
        content: row.content,
        wordCount: words,
        estimatedMinutes: Math.max(1, Math.ceil(words / 200)),
        timestamp: row.updated_at || row.created_at,
        git: row.git,
        locked: row.locked,
        owner: row.owner,
        parent: row.parent || '',
        alias: row.alias,
        type: row.type,
    }
}

function cleanId(value?: string) {
    return (value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120)
}

function cleanAlias(value: string) {
    return cleanId(value).toLowerCase()
}

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}
