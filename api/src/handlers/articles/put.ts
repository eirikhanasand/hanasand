import commitAndPush from '#utils/git/commitAndPush.ts'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import fileExists from '#utils/git/fileExists.ts'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function putArticle(req: FastifyRequest<{ Body: { name: string, content: string } }>, res: FastifyReply) {
    const filePath = join(ARTICLES_DIR, req.body.name)
    let existed = false

    if (await fileExists(filePath)) {
        existed = true
        await writeFile(filePath, req.body.content)
    } else {
        await ensureRepositoryUpToDate()
        if (await fileExists(filePath)) {
            existed = true
            await writeFile(filePath, req.body.content)
        } else {
            return res.status(404).send({ error: 'Article does not exist' })
        }
    }

    await commitAndPush(`${existed ? 'Update' : 'Create'} article ${req.body.name}`)
    return res.send({ updated: true, existed, name: req.body.name })
}
