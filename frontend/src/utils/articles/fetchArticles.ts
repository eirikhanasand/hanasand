import { articles_content, two_weeks_in_ms } from "@parent/constants"
import fetchArticle from "./fetchArticle"
import { prettyDate } from "../prettyDate"

type Articles = {
    recent: Article[]
    articles: Article[]
}

export default async function fetchArticles(): Promise<Articles> {
    try {
        const response = await fetch(articles_content)

        if (!response.ok) {
            throw new Error("Failed to fetch articles.")
        }

        const data = await response.json() as GithubContent[]
        const detailedData = await Promise.all(data.map(async(file) => {
            const article = await fetchArticle(file.name, false)
            if (!article) {
                return null
            }

            return {...file, ...article}
        }))

        const articles: Article[] = []
        const recent: Article[] = []
        for (const article of detailedData) {
            const commits = article?.commits || []
            const now = new Date().getTime()
            const created = new Date(commits[commits.length - 1]?.commit.committer.date || null!).getTime()

            if (article !== null) {
                const parsedFile = parse(article)
                articles.push(parsedFile)

                if (now - created < two_weeks_in_ms) {
                    recent.push(parsedFile)
                }
            }
        }

        return { recent, articles }
    } catch (error) {
        console.log(error)
        return {
            recent: [],
            articles: []
        }
    }
}

function parse(file: GitHubFile): Article {
    const name = file.name
    const text = file.text
    const imageMatch = text.match(/image:\s*"(.*?)"/)
    const descriptionMatch = text.match(/description:\s*"(.*?)"/)
    const contentMatch = text.match(/---[\s\S]*?---\s*([\s\S]*)/)
    const image = imageMatch ? imageMatch[1] : ""
    const description = descriptionMatch ? descriptionMatch[1] : ""
    const content = contentMatch ? contentMatch[1].trim() : ""
    const titleMatch = content.match(/^#\s+(.*)/m)
    const title = titleMatch ? titleMatch[1].trim() : ""
    const commits = file.commits
    const href = name.endsWith('.md') ? name.slice(0, name.length - 3) : name

    return {
        ...file,
        title,
        created: prettyDate(commits[commits.length - 1].commit.committer.date),
        image,
        href,
        description: description,
        length: estimateReadingTime(content),
        updated: prettyDate(commits[0].commit.committer.date)
    }
}

function estimateReadingTime(text: string, wpm = 80): ArticleLength {
    const wordCount = text.trim().split(/\s+/).length
    const minutes = wordCount / wpm
    const roundedMinutes = Math.ceil(minutes)

    return {
        wordCount,
        estimatedMinutes: roundedMinutes
    }
}
