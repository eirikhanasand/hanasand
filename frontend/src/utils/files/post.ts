import config from '@/config'

type PostFileProps = {
    name: string
    data: string
    description?: string
    path?: string
    type: string
}

export async function postFile({ name, data, description, path, type }: PostFileProps): Promise<PostFileResponse | 409 | null> {
    try {
        const response = await fetch(`${config.url.cdn}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: description || null, data, path, type }),
        })

        if (response.status === 409) {
            return 409
        }

        if (!response.ok) {
            throw new Error('Failed to upload file')
        }

        const json = await response.json()
        return json
    } catch (err) {
        console.error('Error uploading file:', err)
        return null
    }
}
