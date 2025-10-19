import commitAndPush from '#utils/git/commitAndPush.ts'
import fileExists from '#utils/git/fileExists.ts'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export default async function postArticle(req: FastifyRequest<{ Params: { id: string }, Body: { content: string } }>, res: FastifyReply) {
    const id = req.params.id
    const content = req.body.content
    const filePath = join(ARTICLES_DIR, id)

    if (await fileExists(filePath)) {
        return res.status(409).send({ error: 'Article already exists, use PUT to update' })
    }

    await writeFile(filePath, content)
    await commitAndPush(`Created article ${id}`)

    return res.status(201).send({ created: true, name: id })
}
