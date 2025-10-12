'use client'

import { Dispatch, SetStateAction, useState } from 'react'
import ImagePreview from './imagePreview'

type PreviewProps = {
    url: string
    file: File
    onUpload?: (data: UploadData) => Promise<void>
    setPreview: Dispatch<SetStateAction<string | null>>
    setFile: Dispatch<SetStateAction<File | null>>
}

type UploadData = {
    file: File
    name: string
    description?: string
    path: string
    type: string
}

export default function Preview({ url, file, onUpload, setFile, setPreview }: PreviewProps) {
    const [name, setName] = useState(file.name)
    const [description, setDescription] = useState('')
    const [path, setPath] = useState(file.name)
    const [type] = useState(file.type)
    const [checkingPath, setCheckingPath] = useState(false)
    const [pathAvailable, setPathAvailable] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function checkPath(p: string) {
        setCheckingPath(true)
        try {
            const res = await fetch(`/api/share/check-path?path=${encodeURIComponent(p)}`)
            const data = await res.json()
            setPathAvailable(data.available)
        } catch (err) {
            console.error(err)
            setPathAvailable(false)
        } finally {
            setCheckingPath(false)
        }
    }

    function handleDiscard() {
        setPreview(null)
        setFile(null)
    }

    function handlePathChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value
        setPath(value)
        checkPath(value)
    }

    async function handleUpload() {
        if (!pathAvailable) {
            setError('Path is already taken. Choose another.')
            return
        }
        if (onUpload) {
            setUploading(true)
            try {
                await onUpload({ file, name, description, path, type })
            } catch (err) {
                console.error(err)
                setError('Upload failed.')
            } finally {
                setUploading(false)
            }
        }
    }

    if (!url || !file) return null

    return (
        <div className="bg-dark text-white p-4 rounded-lg w-full space-y-4 grid">
            <div className='grid place-items-center'>
                <ImagePreview file={file} url={url} />
            </div>
            <div className="space-y-2">
                <label className="block">
                    <span className="text-sm font-semibold">Name</span>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full p-2 rounded bg-light text-white"
                    />
                </label>

                <label className="block">
                    <span className="text-sm font-semibold">Description</span>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        maxLength={1024}
                        className="w-full h-fit p-2 rounded bg-light text-white"
                    />
                </label>

                <label className="block">
                    <span className="text-sm font-semibold">Path</span>
                    <input
                        type="text"
                        value={path}
                        onChange={handlePathChange}
                        className="w-full p-2 rounded bg-light text-white"
                    />
                    {checkingPath && <span className="text-xs text-gray-400">Checking availability...</span>}
                    {!pathAvailable && <span className="text-xs text-red-500">Path is taken</span>}
                </label>

                <label className="block">
                    <span className="text-sm font-semibold">File Type</span>
                    <input
                        type="text"
                        value={type}
                        readOnly
                        className="w-full p-2 rounded bg-light text-white cursor-not-allowed"
                    />
                </label>
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <div className="flex justify-end gap-2">
                <button
                    onClick={handleDiscard}
                    className="px-4 py-2 bg-light hover:bg-light/90 rounded cursor-pointer"
                >
                    Discard
                </button>
                <button
                    onClick={handleUpload}
                    disabled={uploading || !pathAvailable}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded disabled:opacity-50 cursor-pointer"
                >
                    {uploading ? 'Uploading...' : 'Upload'}
                </button>
            </div>
        </div>
    )
}
