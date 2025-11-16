import config from '@/config'
import { redirect } from 'next/navigation'

export default async function fetchUsersWithRoles({ id, token }: { id?: string, token?: string }): Promise<UserWithRole[]> {
    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/users`, {
            headers: {
                'Content-Type': 'application/json',
                'id': id,
                'Authorization': `Bearer ${token}`
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to fetch users.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}
