import { postFile } from './post'

type HandleUploadProps = {
    file: File
    name: string
    description?: string
    path: string | null
    type: string
}

export default async function handleUpload({ file, name, description, path, type }: HandleUploadProps) {
    try {
        const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => {
                if (!reader.result || typeof reader.result !== 'string') {
                    reject(new Error("Reader issue"))
                } else {
                    resolve(reader.result.split(',')[1])
                }
            }
            reader.onerror = () => reject(new Error("Failed to read file"))
        })

        const result = await postFile({ name, data, description, path: path || undefined, type })
        return result
    } catch (err) {
        console.error('Failed to upload file:', err)
        return null
    }
}
