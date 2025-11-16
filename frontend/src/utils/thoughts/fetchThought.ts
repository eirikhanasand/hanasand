import config from '@/config'

export default async function fetchThought(id: string): Promise<Thought | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.api}/thought/${id}`, {
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(`Failed to fetch thought ${id}.`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return null
    }
}
