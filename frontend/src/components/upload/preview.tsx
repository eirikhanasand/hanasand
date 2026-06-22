'use client'

import { Dispatch, SetStateAction, useState } from 'react'
import ImagePreview from './imagePreview'
import config from '@/config'
import { postFile } from '@/utils/files/post'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import ErrorNotice from '@/components/error/errorNotice'
import { RotateCcw, UploadCloud } from 'lucide-react'

type PreviewProps = {
    url: string
    file: File
    setPreview: Dispatch<SetStateAction<string | null>>
    setFile: Dispatch<SetStateAction<File | null>>
    setUrl: Dispatch<SetStateAction<string>>
}

export default function Preview({ url, file, setFile, setPreview, setUrl }: PreviewProps) {
    const [name, setName] = useState(file.name)
    const [description, setDescription] = useState('')
    const [path, setPath] = useState<string | null>(null)
    const [type] = useState(file.type)
    const [checkingPath, setCheckingPath] = useState(false)
    const [pathAvailable, setPathAvailable] = useState(true)
    const [uploading, setUploading] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()

    async function checkPath(p: string) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        setCheckingPath(true)

        try {
            const response = await fetch(`${config.url.cdn}/files/check?path=${encodeURIComponent(p)}`, {
                signal: controller.signal
            })
            clearTimeout(timeout)
            const data = await response.json()
            setPathAvailable(!data.exists)
        } catch (error) {
            console.error(error)
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
        const safeName = value.trim().replace(/[^a-zA-Z0-9-_]/g, '_')
        const extension = file?.name?.split('.').pop()?.toLowerCase() || ''
        const pathToCheck = extension ? `${safeName}.${extension}` : safeName
        setPath(safeName)
        checkPath(pathToCheck)
    }

    async function handleUpload() {
        if (!pathAvailable) {
            setError('Path is already taken. Choose another.')
            return
        }

        setUploading(true)
        try {
            const status = await postFile({ name, file, description, path: path || undefined, type })
            if (status === 409) {
                setError('Path is already taken. Choose another.')
            }

            if (status === 413) {
                return setError('File is too large for the current upload limit.')
            }

            if (!status || typeof status === 'number' || typeof status !== 'number' && !('id' in status)) {
                return setError('Upload failed. Try again later.')
            }

            if (status.id) {
                setUrl(`${config.url.cdn}/files/${path ? `path/${path}` : status.id}`)
            }
        } catch (error) {
            console.error(error)
            setError('Upload failed.')
        } finally {
            setUploading(false)
        }
    }


    if (!url || !file) return null

    return (
        <div className='grid w-full overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-[0_20px_70px_rgba(26,35,55,0.10)] lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]'>
            <div className='grid min-h-[360px] place-items-center border-b border-[#e0e5ed] bg-[#f8fafc] p-4 lg:border-b-0 lg:border-r'>
                <ImagePreview file={file} url={url} />
            </div>
            <div className='grid gap-4 p-4 sm:p-6'>
                <div className='grid gap-1'>
                    <h1 className='text-lg font-semibold text-[#171a21]'>Review upload</h1>
                    <p className='text-sm leading-6 text-[#596170]'>Name it, choose an optional public path, then publish.</p>
                </div>

                <label className='grid gap-2'>
                    <span className='text-xs font-semibold uppercase text-[#3056d3]'>Name</span>
                    <input
                        type='text'
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className='h-10 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
                    />
                </label>

                <label className='grid gap-2'>
                    <span className='text-xs font-semibold uppercase text-[#3056d3]'>Description</span>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        maxLength={1024}
                        className='min-h-24 resize-none rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm leading-6 text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
                    />
                </label>

                <label className='grid gap-2'>
                    <span className='text-xs font-semibold uppercase text-[#3056d3]'>Path</span>
                    <input
                        type='text'
                        value={path || ''}
                        onChange={handlePathChange}
                        placeholder='optional-short-name'
                        className='h-10 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
                    />
                    {checkingPath && <span className='text-xs text-[#667085]'>Checking availability...</span>}
                    {!pathAvailable && <ErrorNotice compact className='mt-2' message='Path is taken' />}
                </label>

                <label className='grid gap-2'>
                    <span className='text-xs font-semibold uppercase text-[#3056d3]'>File type</span>
                    <input
                        type='text'
                        value={type}
                        readOnly
                        className='h-10 cursor-not-allowed rounded-lg border border-[#d8dee9] bg-[#f8fafc] px-3 text-sm text-[#667085] outline-none'
                    />
                </label>

                {error && <ErrorNotice compact message={error} />}

                <div className='flex flex-wrap justify-end gap-2'>
                    <button
                        type='button'
                        onClick={handleDiscard}
                        className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#bdc7d5]'
                    >
                        <RotateCcw className='h-4 w-4' />
                        Discard
                    </button>
                    <button
                        type='button'
                        onClick={handleUpload}
                        disabled={uploading || !pathAvailable}
                        className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:border disabled:border-[#d8dee9] disabled:bg-[#f5f7fb] disabled:text-[#98a2b3]'
                    >
                        <UploadCloud className='h-4 w-4' />
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </div>
        </div>
    )
}
