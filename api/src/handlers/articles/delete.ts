import fileExists from '#utils/git/fileExists.ts'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { unlink } from 'fs/promises'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import commitAndPush from '#utils/git/commitAndPush.ts'
import { join } from 'path'
import { articleOwnership, requireEditorialWrite } from '#utils/contentOrganization.ts'
import run from '#db'

export default async function deleteArticle(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { id: Id } = req.params
    const id = Id.endsWith('.md') ? Id : `${Id}.md`
    if (!/^[\w.-]+\.md$/.test(id) || id.startsWith('.')) return res.status(400).send({ error: 'Invalid article id.' })
    const ownership = await articleOwnership(id)
    if (!await requireEditorialWrite(req, res, ownership?.organization_id || null)) return
    const filePath = join(ARTICLES_DIR, id)
    let deleted = false

    if (await fileExists(filePath)) {
        await unlink(filePath)
        deleted = true
    } else {
        await ensureRepositoryUpToDate()
        if (await fileExists(filePath)) {
            await unlink(filePath)
            deleted = true
        }
    }

    if (!deleted) {
        return res.status(404).send({ error: 'Article does not exist' })
    }

    await commitAndPush(`Deleted article ${id}.`)
    await run('DELETE FROM article_ownership WHERE id = $1', [id])
    return res.send({ deleted: true, id })
}
