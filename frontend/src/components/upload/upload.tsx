import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import getFetchableUrl from './getFetchAbleUrl'
import { Camera, GalleryHorizontalEnd, ImageIcon, LinkIcon, UploadCloud } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useCallback, useState } from 'react'

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
            console.log(`Not a valid URL or failed to fetch image: ${error}`)
            setMessage('Paste a direct image or video URL, or choose a local file.')
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
        const blob = await response.blob()
        const type = blob.type || 'image/png'
        return new File([blob], fileName, { type })
    }

    if (preview) {
        return <></>
    }

    return (
        <div className='grid overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-[0_20px_70px_rgba(26,35,55,0.10)] md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]'>
            <div
                className={`hidden min-h-[420px] place-items-center border-r border-[#e0e5ed] bg-[#f8fafc] p-6 transition md:grid ${isDragging ? 'bg-[#eef3ff]' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <label
                    htmlFor='fileInputDesktop'
                    className='grid cursor-pointer place-items-center gap-4 rounded-lg border border-dashed border-[#cfd7e4] bg-white p-10 text-center transition hover:border-[#3056d3] hover:bg-[#eef3ff]'
                >
                    <span className='grid h-12 w-12 place-items-center rounded-lg border border-[#dfe5ee] bg-[#f8fafc] text-[#3056d3]'>
                        <UploadCloud className='h-5 w-5' />
                    </span>
                    <span className='grid gap-1'>
                        <span className='text-sm font-semibold text-[#171a21]'>Drop media here</span>
                        <span className='text-xs leading-5 text-[#667085]'>Images and videos are supported.</span>
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
                    <h1 className='text-lg font-semibold text-[#171a21]'>Upload media</h1>
                    <p className='text-sm leading-6 text-[#596170]'>Choose a file or paste a fetchable media URL.</p>
                </div>

                <div className='grid gap-3'>
                    <label
                        htmlFor='fileInputMobile'
                        className='flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'
                    >
                        <ImageIcon className='h-4 w-4' />
                        Choose photo or video
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
                        className='flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#bdc7d5] md:hidden'
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
                        <span className='flex items-center gap-2 text-xs font-semibold uppercase text-[#3056d3]'>
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
                            className='h-11 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-medium text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
                        />
                    </label>
                </div>

                {isFetching ? <ErrorNotice compact variant='info' message='Fetching media preview...' /> : null}
                {message ? <ErrorNotice compact variant='info' message={message} /> : null}

                <Link href='/gallery' className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#bdc7d5]'>
                    <GalleryHorizontalEnd className='h-4 w-4' />
                    My uploads
                </Link>
            </div>
        </div>
    )
}
