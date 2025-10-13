import config from '@/config'

type PostFileProps = {
    name: string
    file: File
    description?: string
    path?: string
    type: string
}

export async function postFile({ name, file, description, path, type }: PostFileProps) {
    try {
        const formData = new FormData()
        formData.append('name', name)
        formData.append('file', file)

        if (description) {
            formData.append('description', description)
        }

        if (path) {
            formData.append('path', path)
        }

        formData.append('type', type)
        const response = await fetch(`${config.url.cdn}/files`, {
            method: 'POST',
            body: formData,
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
