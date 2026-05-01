import config from '@/config'
import { uploadTimeoutForFileSize } from './uploadTimeout'
import { getCookie } from '@/utils/cookies/cookies'

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
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), uploadTimeoutForFileSize(file.size, config.abortTimeout * 10))
        const token = getCookie('access_token')
        const userId = getCookie('id')
        const response = await fetch(`${config.url.cdn}/files`, {
            method: 'POST',
            body: formData,
            headers: token && userId ? {
                Authorization: `Bearer ${token}`,
                id: userId
            } : undefined,
            signal: controller.signal
        })

        clearTimeout(timeout)
        if (response.status === 409) {
            return 409
        }

        if (!response.ok) {
            return response.status
        }

        const json = await response.json()
        return json
    } catch (error) {
        console.error(`Error uploading file: ${error}`)
        return null
    }
}
