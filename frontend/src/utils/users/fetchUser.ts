import config from '@/config'

export default async function fetchUser(id: string): Promise<User | null> {
    try {
        const response = await fetch(`${config.url.api}/user/${id}`)

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
