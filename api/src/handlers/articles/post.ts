import commitAndPush from '#utils/git/commitAndPush.ts'
import fileExists from '#utils/git/fileExists.ts'
import { ARTICLES_DIR } from '#utils/git/git.ts'
import hasRole from '#utils/auth/hasRole.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export default async function postArticle(req: FastifyRequest<{ Params: { id: string }, Body: { content: string } }>, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasRole(req, res, 'content_admin')
    if (!valid || !validRole) {
        return res.status(404).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string } ?? {}
    const { content } = req.body as { content: string } ?? {}
    const filePath = join(ARTICLES_DIR, id)

    if (await fileExists(filePath)) {
        return res.status(409).send({ error: 'Article already exists, use PUT to update' })
    }

    await writeFile(filePath, content)
    await commitAndPush(`Created article ${id}`)

    return res.status(201).send({ created: true, name: id })
}
