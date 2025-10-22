import commitAndPush from '#utils/git/commitAndPush.ts'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import fileExists from '#utils/git/fileExists.ts'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import tokenWrapper from '#utils/tokenWrapper.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export default async function putArticle(req: FastifyRequest<{ Params: { id: string }, Body: { content: string } }>, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params
    const content = req.body.content
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
