import config from '@/config'

type PostShareProps = {
    id: string
    content: string
    includeTree?: boolean
    path?: string
    name?: string
    parent?: string
    type?: string
    token?: string | null
    userId?: string | null
}

export default async function postShare({
    includeTree,
    id,
    path,
    content,
    name,
    parent,
    type,
    token,
    userId
}: PostShareProps): Promise<Share | ShareWithTree | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.cdn}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                id: userId || ''
            },
            body: JSON.stringify({ id, includeTree, name, path, content, parent, type }),
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (!response.ok) {
            throw new Error('Failed to create share')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(`Error creating share: ${error}`)
        return null
    }
}
