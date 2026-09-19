import commitAndPush from '#utils/git/commitAndPush.ts'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import fileExists from '#utils/git/fileExists.ts'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import { articleOwnership, requireEditorialWrite } from '#utils/contentOrganization.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export default async function putArticle(req: FastifyRequest<{ Params: { id: string }, Body: { content: string } }>, res: FastifyReply) {
    const { id: Id } = req.params
    const id = Id.endsWith('.md') ? Id : `${Id}.md`
    if (!/^[\w.-]+\.md$/.test(id) || id.startsWith('.')) return res.status(400).send({ error: 'Invalid article id.' })
    const ownership = await articleOwnership(id)
    if (!await requireEditorialWrite(req, res, ownership?.organization_id || null)) return
    const content = req.body.content
    if (typeof content !== 'string') return res.status(400).send({ error: 'Article content must be text.' })
    const filePath = join(ARTICLES_DIR, id)

    if (await fileExists(filePath)) {
        await writeFile(filePath, content)
    } else {
        await ensureRepositoryUpToDate()
        if (await fileExists(filePath)) {
            await writeFile(filePath, content)
        } else {
            return res.status(404).send({ error: `Article ${id} does not exist` })
        }
    }

    await commitAndPush(`Updated article ${id}`)
    return res.send({ updated: true, id })
}
