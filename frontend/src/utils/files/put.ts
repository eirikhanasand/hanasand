import config from '@/config'

export async function updateFile(id: string, updates: { path?: string; content?: string }): Promise<Share | null> {
    try {
        const res = await fetch(`${config.url.cdn}/files/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        })

        if (!res.ok) throw new Error('Failed to update share')
        const data = await res.json()
        return data
    } catch (err) {
        console.error('Error updating share:', err)
        return null
    }
}
