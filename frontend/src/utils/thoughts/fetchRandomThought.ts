import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export default async function fetchRandomThought(): Promise<Thought | null> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/thought/random`, {
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error('Failed to fetch random thought.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
