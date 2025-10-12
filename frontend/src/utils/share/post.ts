import config from '@/config'

export async function postShare(path: string, content: string): Promise<Share | null> {
    try {
        const res = await fetch(`${config.url.cdn}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content }),
        })

        if (!res.ok) throw new Error('Failed to create share')
        const data = await res.json()
        return data
    } catch (err) {
        console.error('Error creating share:', err)
        return null
    }
}
