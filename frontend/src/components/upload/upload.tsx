import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import getFetchableUrl from './getFetchAbleUrl'
import { Camera, GalleryHorizontalEnd, ImageIcon, LinkIcon, UploadCloud } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useCallback, useState } from 'react'

const MAX_PUBLIC_MEDIA_BYTES = 20 * 1024 * 1024

type UploadProps = {
    url: string
    setUrl: Dispatch<SetStateAction<string>>
    setFile: Dispatch<SetStateAction<File | null>>
    preview: string | null
    setPreview: Dispatch<SetStateAction<string | null>>
}

export default function Upload({ url, setUrl, setFile, preview, setPreview }: UploadProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const handleFile = useCallback((file: File) => {
        setMessage(null)
        const validationError = validatePublicMediaFile(file)
        if (validationError) {
            setFile(null)
            setPreview(null)
            setMessage(validationError)
            return
        }

        setFile(file)
        const url = URL.createObjectURL(file)
        setPreview(url)
    }, [setFile, setPreview])

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) handleFile(selectedFile)
    }

    function handleDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
        setIsDragging(false)
        const droppedFile = e.dataTransfer.files?.[0]
        if (droppedFile) handleFile(droppedFile)
    }

    function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
        setIsDragging(true)
    }

    function handleDragLeave() {
        setIsDragging(false)
    }

    async function handlePasteOrChange(value: string) {
        setUrl(value)
        setMessage(null)

        if (!value.trim()) {
            return
        }

        try {
            const urlObj = new URL(value)
            const fileName = urlObj.pathname.split('/').pop() || 'image.png'
            setIsFetching(true)
            const file = await fetchImageAsFile(value, fileName)
            handleFile(file)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Paste a direct image or video URL, or choose a local file.')
        } finally {
            setIsFetching(false)
        }
    }

    async function fetchImageAsFile(url: string, fileName: string) {
        const fetchableUrl = getFetchableUrl(url)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`/api/image?url=${encodeURIComponent(fetchableUrl)}`, {
            signal: controller.signal
        })
        clearTimeout(timeout)
        if (!response.ok) {
            const payload = await response.json().catch(() => ({})) as { error?: string }
            throw new Error(payload.error || 'Remote media could not be fetched.')
        }
        const blob = await response.blob()
        const type = blob.type || 'image/png'
        const validationError = validatePublicMediaFile(new File([blob], fileName, { type }))
        if (validationError) {
            throw new Error(validationError)
        }
        return new File([blob], fileName, { type })
    }

    if (preview) {
        return <></>
    }

    return (
        <div className='grid overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-md md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]'>
            <div
                className={`hidden min-h-[420px] place-items-center border-r border-ui-border bg-ui-raised p-6 transition md:grid ${isDragging ? 'bg-ui-primary/10' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <label
                    htmlFor='fileInputDesktop'
                    className='grid cursor-pointer place-items-center gap-4 rounded-lg border border-dashed border-ui-border bg-ui-panel p-10 text-center transition hover:border-ui-primary hover:bg-ui-primary/10'
                >
                    <span className='grid h-12 w-12 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                        <UploadCloud className='h-5 w-5' />
                    </span>
                    <span className='grid gap-1'>
                        <span className='text-sm font-semibold text-ui-text'>Drop public media here</span>
                        <span className='text-xs leading-5 text-ui-muted'>Images and videos only. Do not upload secrets or customer evidence.</span>
                    </span>
                    <input
                        id='fileInputDesktop'
                        type='file'
                        accept='image/*,video/*'
                        className='hidden'
                        onChange={handleFileChange}
                    />
                </label>
            </div>
            <div className='grid gap-5 p-4 sm:p-6'>
                <div className='grid gap-1'>
                    <h2 className='text-lg font-semibold text-ui-text'>Upload shareable media</h2>
                    <p className='text-sm leading-6 text-ui-muted'>Choose a public-safe file or paste a direct public image/video URL.</p>
                </div>

                <div className='grid gap-3'>
                    <label
                        htmlFor='fileInputMobile'
                        className='flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'
                    >
                        <ImageIcon className='h-4 w-4' />
                        Choose public photo or video
                        <input
                            id='fileInputMobile'
                            type='file'
                            accept='image/*,video/*'
                            className='hidden'
                            onChange={handleFileChange}
                        />
                    </label>
                    <label
                        htmlFor='cameraInput'
                        className='flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary md:hidden'
                    >
                        <Camera className='h-4 w-4' />
                        Use camera
                        <input
                            id='cameraInput'
                            type='file'
                            accept='image/*,video/*'
                            capture='environment'
                            className='hidden'
                            onChange={handleFileChange}
                        />
                    </label>
                    <label className='grid gap-2'>
                        <span className='flex items-center gap-2 text-xs font-semibold uppercase text-ui-primary'>
                            <LinkIcon className='h-3.5 w-3.5' />
                            URL
                        </span>
                        <input
                            placeholder='https://example.com/image.png'
                            value={url}
                            onChange={(e) => handlePasteOrChange(e.target.value)}
                            onPaste={(e) => {
                                const pastedText = e.clipboardData.getData('text')
                                handlePasteOrChange(pastedText)
                            }}
                            className='h-11 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'
                        />
                    </label>
                </div>

                {isFetching ? <ErrorNotice compact variant='info' message='Fetching media preview...' /> : null}
                {message ? <ErrorNotice compact variant='info' message={message} /> : null}

                <Link href='/gallery' className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                    <GalleryHorizontalEnd className='h-4 w-4' />
                    My uploads
                </Link>
            </div>
        </div>
    )
}

function validatePublicMediaFile(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        return 'Only public image or video files can be uploaded here.'
    }

    if (file.size > MAX_PUBLIC_MEDIA_BYTES) {
        return 'Public media must be 20 MB or smaller.'
    }

    return null
}
