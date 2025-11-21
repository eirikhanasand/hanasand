import config from '@/config'
import { redirect } from 'next/navigation'

type FetchRoleProps = { 
    id: string
    token: string
    target?: string
}

export default async function getUserRoles({ id, token, target }: FetchRoleProps): Promise<SmallRole[]> {
    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.api}/roles/user/${target || id}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                id
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to fetch user roles.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return []
    }
}
