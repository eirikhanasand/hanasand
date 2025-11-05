import config from '@/config'

export async function lockShare(share: Share, name: string): Promise<Share | null> {
    try {
        const res = await fetch(`${config.url.cdn}/share/lock/${share.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ...share, name })
        })

        if (!res.ok) {
            throw new Error('Failed to lock/unlock share')
        }

        const data = await res.json()
        return data
    } catch (error) {
        console.error(`Error locking/unlocking share: ${error}`)
        return null
    }
}
