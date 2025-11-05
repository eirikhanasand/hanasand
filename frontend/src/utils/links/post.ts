import config from '@/config'

export async function postLink(id: string, path: string): Promise<Link | 409 | null> {
    try {
        const res = await fetch(`${config.url.cdn}/link/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path }),
        })

        if (res.status === 409) {
            return 409
        }

        if (!res.ok) {
            throw new Error('Failed to create link')
        }

        const data = await res.json()
        return data
    } catch (error) {
        console.error(`Error creating link: ${error}`)
        return null
    }
}
