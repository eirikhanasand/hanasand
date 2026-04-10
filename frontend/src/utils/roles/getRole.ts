import config from '@/config'

type GetRoleProps = {
    id: string
    token: string
    roleId: string
}

export default async function getRole({ id, token, roleId }: GetRoleProps): Promise<Role | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.api}/role/${roleId}`, {
            headers: {
                'Content-Type': 'application/json',
                id,
                Authorization: `Bearer ${token}`
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to fetch role.')
        }

        return await response.json()
    } catch (error) {
        console.log(error)
        return null
    }
}
