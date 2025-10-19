import { ARTICLES_DIR } from '#utils/git/git.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import fileExists from '#utils/git/fileExists.ts'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import { readdir, stat, readFile } from 'fs/promises'
import matter from 'gray-matter'
import { join } from 'path'
import estimateReadingTime from '#utils/estimateReadTime.ts'

const two_weeks_in_ms = 1209600000

export default async function getArticles(req: FastifyRequest<{ Querystring: { recent?: string } }>, res: FastifyReply) {
    const recent = req.query.recent
    await ensureRepositoryUpToDate()

    if (!(await fileExists(ARTICLES_DIR))) {
        return res.status(404).send({ error: 'Articles directory does not exist' })
    }

    const files = await readdir(ARTICLES_DIR)
    const articles = []
    const old = []

    for (const file of files) {
        const filePath = join(ARTICLES_DIR, file)
        const stats = await stat(filePath)

        if (stats.isFile()) {
            const content = await readFile(filePath, 'utf-8')
            const parsed = matter(content)
            const body = parsed.content.trim()
            const readTime = estimateReadingTime(body)
            const data = {
                id: file,
                size: stats.size,
                modified: stats.mtime,
                metadata: { ...parsed.data, ...readTime },
            }

            if (recent) {
                if (new Date(stats.mtime).getTime() < two_weeks_in_ms) {
                    old.push(data)
                }
            }

            articles.push(data)
        }
    }

    return res.send(recent ? { recent: articles, articles: old } : { articles })
}

export async function getArticle(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const id = req.params.id
    const filePath = join(ARTICLES_DIR, id)
    if (!(await fileExists(filePath))) {
        await ensureRepositoryUpToDate()
        if (!(await fileExists(filePath))) {
            return res.status(404).send({ error: 'Article does not exist' })
        }
    }

    const stats = await stat(filePath)
    const content = await readFile(filePath, 'utf-8')
    const parsed = matter(content)
    const body = parsed.content.trim()
    const readTime = estimateReadingTime(body)
    return res.send({
        id,
        size: stats.size,
        modified: stats.mtime,
        metadata: { ...parsed.data, ...readTime },
        content: body,
    })
}
