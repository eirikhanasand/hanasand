import config from '@/config'

type GetUserSharesProps = {
    id: string
    token: string
}

export async function getUserShares({ id, token }: GetUserSharesProps): Promise<Share[] | string> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 1000)
        const response = await fetch(`${config.url.cdn}/share/user/${id}`, { 
            headers: {
                'Authorization': `Bearer ${token}`,
                id
            },
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error(`Failed to fetch shares for user ${id}`)
        }

        const data = await response.json()
        return data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error(error)
        if (error.name === 'AbortError') {
            console.warn('Request aborted (timeout reached)')
            return 'Unable to load shares.'
        } else {
            console.error(`Fetch failed: ${error}`)
            return `Shares not found.`
        }
    }
}
