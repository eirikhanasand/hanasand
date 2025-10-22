import config from '@/config'

export default async function fetchThoughts(): Promise<Thought[]> {
    try {
        const response = await fetch(`${config.url.api}/thoughts`)
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