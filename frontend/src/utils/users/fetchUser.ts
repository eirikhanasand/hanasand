import config from '@/config'

export default async function fetchUser(id: string): Promise<User | null> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/user/${encodeURIComponent(id)}`, {
            signal: controller.signal, cache: 'no-store'
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('This user does not exist.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(error)
        return null
    }
}
