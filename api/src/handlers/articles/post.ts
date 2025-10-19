import commitAndPush from '#utils/git/commitAndPush.ts'
import fileExists from '#utils/git/fileExists.ts'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function postArticle(req: FastifyRequest<{ Body: { name: string, content: string } }>, res: FastifyReply) {
    const filePath = join(ARTICLES_DIR, req.body.name)

    if (await fileExists(filePath)) {
        return res.status(409).send({ error: 'Article already exists, use PUT to update' })
    }

    await writeFile(filePath, req.body.content)
    await commitAndPush(`Create article ${req.body.name}`)

    return res.status(201).send({ created: true, name: req.body.name })
}
