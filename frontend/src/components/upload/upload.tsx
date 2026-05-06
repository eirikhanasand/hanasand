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
        <div className='grid overflow-hidden rounded-xl border border-white/10 bg-dark/70 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-md md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]'>
            <div
                className={`hidden min-h-[420px] place-items-center border-r border-white/10 bg-black/16 p-6 transition md:grid ${isDragging ? 'bg-[#f07d33]/8' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <label
                    htmlFor='fileInputDesktop'
                    className='grid cursor-pointer place-items-center gap-4 rounded-xl border border-dashed border-white/14 bg-white/[0.035] p-10 text-center transition hover:border-[#f07d33]/45 hover:bg-[#f07d33]/8'
                >
                    <span className='grid h-12 w-12 place-items-center rounded-xl bg-white/[0.055] text-[#f0a17a]'>
                        <UploadCloud className='h-5 w-5' />
                    </span>
                    <span className='grid gap-1'>
                        <span className='text-sm font-medium text-bright/82'>Drop media here</span>
                        <span className='text-xs leading-5 text-bright/42'>Images and videos are supported.</span>
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
                    <h1 className='text-lg font-semibold text-bright/88'>Upload media</h1>
                    <p className='text-sm leading-6 text-bright/45'>Choose a file or paste a fetchable media URL.</p>
                </div>

                <div className='grid gap-3'>
                    <label
                        htmlFor='fileInputMobile'
                        className='flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-4 text-sm font-medium text-bright/76 transition hover:bg-white/8 hover:text-bright'
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
                        className='flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-bright/62 transition hover:bg-white/6 hover:text-bright md:hidden'
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
                        <span className='flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-bright/34'>
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
                            className='h-11 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-bright outline-none transition placeholder:text-bright/28 focus:border-[#f07d33]/55 focus:bg-white/[0.065]'
                        />
                    </label>
                </div>

                {isFetching ? <ErrorNotice compact variant='info' message='Fetching media preview...' /> : null}
                {message ? <ErrorNotice compact variant='info' message={message} /> : null}

                <Link href='/gallery' className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-bright/58 transition hover:bg-white/6 hover:text-bright'>
                    <GalleryHorizontalEnd className='h-4 w-4' />
                    My uploads
                </Link>
            </div>
        </div>
    )
}
