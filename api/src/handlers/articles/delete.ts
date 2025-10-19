import fileExists from '#utils/git/fileExists.ts'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { unlink } from 'fs/promises'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import commitAndPush from '#utils/git/commitAndPush.ts'
import { join } from 'path'

export async function deleteArticle(req: FastifyRequest<{ Params: { name: string } }>, res: FastifyReply) {
    const filePath = join(ARTICLES_DIR, req.params.name)
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

    await commitAndPush(`Deleted article ${req.params.name}.`)
    return res.send({ deleted: true, name: req.params.name })
}
