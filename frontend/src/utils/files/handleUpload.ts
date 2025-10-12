import { postFile } from './post'

type HandleUploadProps = {
    file: File
    name: string
    description?: string
    path: string
    type: string
}

export default async function handleUpload({ file, name, description, path, type }: HandleUploadProps) {
    try {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = async () => {
            if (!reader.result || typeof reader.result !== 'string') return
            const data = reader.result.split(',')[1]
            const result = await postFile({name, data, description, path, type})
            return result
        }
    } catch (err) {
        console.error('Failed to upload file:', err)
    }
}
