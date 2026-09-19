import commitAndPush from '#utils/git/commitAndPush.ts'
import fileExists from '#utils/git/fileExists.ts'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import { requestedContentOrganization, requireEditorialWrite } from '#utils/contentOrganization.ts'
import run from '#db'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export default async function postArticle(req: FastifyRequest<{ Params: { id: string }, Body: { content: string } }>, res: FastifyReply) {
    const organizationId = requestedContentOrganization(req)
    if (!await requireEditorialWrite(req, res, organizationId)) return

    const { id: Id } = req.params as { id: string } ?? {}
    const id = Id.endsWith('.md') ? Id : `${Id}.md`
    if (!/^[\w.-]+\.md$/.test(id) || id.startsWith('.')) return res.status(400).send({ error: 'Invalid article id.' })
    const { content } = req.body as { content: string } ?? {}
    const filePath = join(ARTICLES_DIR, id)

    if (await fileExists(filePath)) {
        return res.status(409).send({ error: 'Article already exists, use PUT to update' })
    }

    if (typeof content !== 'string') return res.status(400).send({ error: 'Article content must be text.' })
    const registered = await run(`INSERT INTO article_ownership (id, owner_id, organization_id)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`, [id, organizationId ? null : req.headers.id as string, organizationId])
    if (!registered.rows.length) return res.status(409).send({ error: 'Article already exists.' })
    try {
        await writeFile(filePath, content, { flag: 'wx' })
    } catch (error) {
        await run('DELETE FROM article_ownership WHERE id = $1', [id])
        throw error
    }
    await commitAndPush(`Created article ${id}`)

    return res.status(201).send({ created: true, name: id })
}
