import config from '@/config'

export default async function fetchUser(id: string): Promise<User | null> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1000)
        const response = await fetch(`${config.url.api}/user/${id}`, {
            signal: controller.signal
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
