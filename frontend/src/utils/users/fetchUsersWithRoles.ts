import config from '@/config'
import { redirect } from 'next/navigation'

export default async function fetchUsersWithRoles({ id, token }: { id?: string, token?: string }): Promise<UserWithRole[]> {
    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    try {
        const response = await fetch(`${config.url.api}/users`, {
            headers: {
                'Content-Type': 'application/json',
                'id': id,
                'Authorization': `Bearer ${token}`
            }
        })

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
