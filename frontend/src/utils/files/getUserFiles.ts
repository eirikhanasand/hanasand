import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

export type UserUpload = {
    id: string
    name: string
    description: string | null
    type: string
    path: string
    owner: string
    uploaded_at: string
}

export async function getUserFiles(limit = 60): Promise<UserUpload[]> {
    const token = getCookie('access_token')
    const userId = getCookie('id')

    if (!token || !userId) {
        return []
    }

    try {
        const response = await fetch(`${config.url.cdn}/files/user/${encodeURIComponent(userId)}?limit=${limit}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                id: userId
            }
        })

        if (!response.ok) {
            return []
        }

        const data = await response.json()
        return Array.isArray(data) ? data : []
    } catch (error) {
        console.error('Failed to fetch upload history:', error)
        return []
    }
}
