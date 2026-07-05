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
        <div className='grid w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-lg lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]'>
            <div className='grid min-h-[360px] place-items-center border-b border-ui-border bg-ui-raised p-4 lg:border-b-0 lg:border-r'>
                <ImagePreview file={file} url={url} />
            </div>
            <div className='grid gap-4 p-4 sm:p-6'>
                <div className='grid gap-1'>
                    <h1 className='text-lg font-semibold text-ui-text'>Review public media</h1>
                    <p className='text-sm leading-6 text-ui-muted'>Name it, choose an optional public path, then publish only if this can be shared outside your organization.</p>
                </div>

                <label className='grid gap-2'>
                    <span className='text-xs font-semibold uppercase text-ui-primary'>Name</span>
                    <input
                        type='text'
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className='h-10 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'
                    />
                </label>

                <label className='grid gap-2'>
                    <span className='text-xs font-semibold uppercase text-ui-primary'>Description</span>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        maxLength={1024}
                        className='min-h-24 resize-none rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm leading-6 text-ui-text outline-none transition focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'
                    />
                </label>

                <label className='grid gap-2'>
                    <span className='text-xs font-semibold uppercase text-ui-primary'>Path</span>
                    <input
                        type='text'
                        value={path || ''}
                        onChange={handlePathChange}
                        placeholder='optional-short-name'
                        className='h-10 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'
                    />
                    {checkingPath && <span className='text-xs text-ui-muted'>Checking availability...</span>}
                    {!pathAvailable && <ErrorNotice compact className='mt-2' message='Path is taken' />}
                </label>

                <label className='grid gap-2'>
                    <span className='text-xs font-semibold uppercase text-ui-primary'>File type</span>
                    <input
                        type='text'
                        value={type}
                        readOnly
                        className='h-10 cursor-not-allowed rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-muted outline-none'
                    />
                </label>

                {error && <ErrorNotice compact message={error} />}

                <div className='flex flex-wrap justify-end gap-2'>
                    <button
                        type='button'
                        onClick={handleDiscard}
                        className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary/50'
                    >
                        <RotateCcw className='h-4 w-4' />
                        Discard
                    </button>
                    <button
                        type='button'
                        onClick={handleUpload}
                        disabled={uploading || !pathAvailable}
                        className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:bg-ui-primary/90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
                    >
                        <UploadCloud className='h-4 w-4' />
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </div>
        </div>
    )
}
