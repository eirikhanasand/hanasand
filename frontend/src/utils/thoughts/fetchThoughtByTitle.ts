import config from '@/config'

export default async function fetchThoughtByTitle(title: string): Promise<Thought[]> {
    try {
        const response = await fetch(`${config.url.api}/thoughts`, {
            body: JSON.stringify({ title })
        })

        if (!response.ok) {
            throw new Error('Failed to fetch thoughts.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}