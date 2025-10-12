import { articles, articles_commits } from "@parent/constants"

export default async function fetchArticle(page: string, suffix: boolean = true) {
    try {
        const textResponse = await fetch(`${articles}${page}${suffix ? '.md' : ''}`)
        const commitResponse = await fetch(`${articles_commits}${page}${suffix ? '.md' : ''}`)

        if (!textResponse.ok || !commitResponse.ok) {
            throw new Error("This page does not exist.")
        }

        const text = await textResponse.text()
        const commits = await commitResponse.json() as Commit[]
        return { text, commits }
    } catch (error) {
        console.error(error)
        return null
    }
}
