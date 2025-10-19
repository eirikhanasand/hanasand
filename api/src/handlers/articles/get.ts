import { ARTICLES_DIR } from '#utils/git/git.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import fileExists from '#utils/git/fileExists.ts'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function getArticle(req: FastifyRequest<{ Params: { name: string } }>, res: FastifyReply) {
    const filePath = join(ARTICLES_DIR, req.params.name)
    if (!(await fileExists(filePath))) {
        await ensureRepositoryUpToDate()
        if (!(await fileExists(filePath))) {
            return res.status(404).send({ error: 'Article does not exist' })
        }
    }

    const content = await readFile(filePath, 'utf-8')
    return res.send({ name: req.params.name, content })
}
