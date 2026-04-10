import config from '@/config'
import { getCookie } from '../cookies/cookies'

export default async function setUserActive(userId: string, active: boolean): Promise<{ status: number, user?: User, message?: string }> {
    const token = getCookie('access_token')
    const id = getCookie('id')
    if (!token || !id) {
        return { status: 401, message: 'Unauthorized.' }
    }

    const response = await fetch(`${config.url.api}/user/${userId}/active`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            id,
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active }),
    })

    const body = await response.json().catch(() => ({}))
    return {
        status: response.status,
        user: response.ok ? body : undefined,
        message: body.error || body.message,
    }
}
