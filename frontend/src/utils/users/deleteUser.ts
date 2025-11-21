import config from '@/config'
import { getCookie } from '../cookies/cookies'

export default async function deleteUser(id: string): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const userId = getCookie('id')
        if (!token || !userId) {
            return {
                status: 401,
                message: 'Please log in to delete users.'
            }
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/user/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'id': userId || ''
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(await response.text())
        }

        return {
            status: response.status,
            message: `Deleted user ${id}.`
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to delete user ${id}.`
        }
    }
}
