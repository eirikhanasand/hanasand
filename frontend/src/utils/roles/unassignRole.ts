import config from '@/config'
import { redirect } from 'next/navigation'

type FetchRoleProps = { 
    id: string
    token: string
    role: string
}

type RoleAssignmentResponse = { 
    status: boolean
    data: Role | null
}

export default async function unassignRole({ id, token, role }: FetchRoleProps): Promise<RoleAssignmentResponse> {
    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.api}/role/unassign/${role}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                id
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to fetch roles.')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.log(error)
        return { status: false, data: null }
    }
}
