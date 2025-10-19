import { ARTICLES_DIR } from '#utils/git/git.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import fileExists from '#utils/git/fileExists.ts'
import ensureRepositoryUpToDate from '#utils/git/ensureRepositoryUpToDate.ts'
import { readdir, stat, readFile } from 'fs/promises'
import matter from 'gray-matter'
import { join } from 'path'
import estimateReadingTime from '#utils/estimateReadTime.ts'
import createdAt from '#utils/git/createdAt.ts'
import updatedAt from '#utils/git/updatedAt.ts'

const two_weeks_in_ms = 1209600000

export default async function getArticles(req: FastifyRequest<{
    Querystring: {
        recent?: string,
        backfill?: string,
        sortBy: 'created' | 'updated'
    }
}>, res: FastifyReply) {
    const recent = req.query.recent
    const backfill = req.query.backfill
    const sortBy = req.query.sortBy
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
            const fileContent = await readFile(filePath, 'utf-8')
            const created = await createdAt(filePath)
            const updated = await updatedAt(filePath)
            const parsed = matter(fileContent)
            const content = parsed.content.trim()
            const readTime = estimateReadingTime(content)
            const titleMatch = content.match(/^#\s+(.*)/m)
            const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
            const data = {
                id: file,
                size: stats.size,
                created,
                modified: updated,
                metadata: { ...parsed.data, ...readTime },
                title,
            }

            if (recent) {
                if (new Date(stats.mtime).getTime() < two_weeks_in_ms) {
                    old.push(data)
                }
            }

            articles.push(data)
        }
    }

    // Ensures recent always has 4 articles
    if (backfill) {
        for (const article of old) {
            if (articles.length < 4) {
                articles.push(article)
            }
        }
    }
    
    const articlesByCreated = articles.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
    const articlesByUpdated = articles.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
    const oldArticlesByCreated = old.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
    const oldArticlesByUpdated = old.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
    
    switch (sortBy) {
        case 'created': return res.send(recent 
            ? { recent: articlesByCreated, articles: oldArticlesByCreated } 
            : { articles: articlesByCreated }
        )
    }

    return res.send(recent ?
        {
            recent: articlesByUpdated,
            articles: oldArticlesByUpdated,
        } : {
            articles: articlesByUpdated
        }
    )
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
    const file = await readFile(filePath, 'utf-8')
    const created = await createdAt(filePath)
    const updated = await updatedAt(filePath)
    const parsed = matter(file)
    const content = parsed.content.trim()
    const readTime = estimateReadingTime(content)
    const titleMatch = content.match(/^#\s+(.*)/m)
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
    return res.send({
        id,
        size: stats.size,
        created,
        modified: updated,
        metadata: { ...parsed.data, ...readTime },
        title,
        content,
    })
}
