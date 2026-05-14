import config from '@/config'

type GetUserSharesProps = {
    id: string
    token: string
}

export async function getUserShares({ id, token }: GetUserSharesProps): Promise<Share[] | string> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const normalizedToken = decodeURIComponent(token)
        const response = await fetch(`${config.url.cdn}/share/user/${id}`, {
            headers: {
                'Authorization': `Bearer ${normalizedToken}`,
                id
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (response.status === 404) {
            return []
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch shares for user ${id}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        return error instanceof Error && error.name === 'AbortError'
            ? 'Unable to load shares.'
            : []
    }
}
