import config from '@/config'

export default async function fetchArticle(id: string) {
    try {
        const response = await fetch(`${config.url.api}/article/${id}`)

        if (!response.ok) {
            throw new Error("This page does not exist.")
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(error)
        return null
    }
}
