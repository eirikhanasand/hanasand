import config from '@/config'

export default async function fetchRandomThought(): Promise<Thought | null> {
    try {
        const response = await fetch(`${config.url.api}/thought/random`)
        if (!response.ok) {
            throw new Error(`Failed to fetch random thought.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
