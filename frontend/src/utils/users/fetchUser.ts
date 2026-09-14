import config from '@/config'

export default async function fetchUser(id: string, viewer?: { id: string, token: string }): Promise<User | null> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/user/${encodeURIComponent(id)}`, {
            signal: controller.signal, cache: 'no-store',
            ...(viewer ? { headers: { id: viewer.id, Authorization: `Bearer ${decodeURIComponent(viewer.token)}` } } : {})
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
