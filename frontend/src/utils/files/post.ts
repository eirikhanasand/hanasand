import config from '@/config'

type PostFileProps = {
    name: string
    data: string
    description?: string
    path?: string
    type: string
}

type PostFileResponse = {
    id: string
}

export async function postFile({ name, data, description, path, type }: PostFileProps): Promise<PostFileResponse | null> {
    try {
        const res = await fetch(`${config.url.cdn}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: description || null, data, path, type }),
        })

        if (!res.ok) throw new Error('Failed to upload file')
        const json = await res.json()
        return json
    } catch (err) {
        console.error('Error uploading file:', err)
        return null
    }
}
