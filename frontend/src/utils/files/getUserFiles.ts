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
    size_bytes?: number | string
}
export async function getUserFiles(limit = 60, offset = 0): Promise<UserUpload[]> {
    const token = getCookie('access_token')
    const userId = getCookie('id')
    if (!token || !userId) throw new Error('Sign in to see your library.')
    const response = await fetch(`${config.url.cdn}/files/user/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}`, id: userId },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
    })
    if (response.status === 401) throw new Error('Sign in to see your library.')
    if (!response.ok) throw new Error('Your files could not be loaded. Try again.')
    const data = await response.json()
    if (!Array.isArray(data)) throw new Error('Your files could not be loaded.')
    return data
}
