'use client'

import Preview from '@/components/upload/preview'
import Upload from '@/components/upload/upload'
import config from '@/config'
import { Check, LinkIcon, RotateCcw } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import copy from '@/utils/copy'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { saveRecentUpload } from '@/utils/upload/storage'
import { useEffect } from 'react'

export default function UploadPageClient() {
    const [url, setUrl] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const isUploaded = url.includes(config.url.cdn)
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 1000,
        onClear: () => setDidCopy(false)
    })

    function handleReset() {
        setUrl('')
        setFile(null)
        setPreview(null)
    }

    useEffect(() => {
        if (isUploaded) {
            saveRecentUpload(url)
        }
    }, [isUploaded, url])

    if (isUploaded) {
        return (
            <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
                <div className='grid w-full max-w-xl gap-3'>
                    <div className='rounded-lg border border-ui-border bg-ui-panel p-3 shadow-md'>
                        <div className='grid gap-4'>
                            <div className='flex items-center gap-2 text-sm font-semibold text-ui-success'>
                                <span className='grid h-7 w-7 place-items-center rounded-lg border border-ui-success/25 bg-ui-success/10 text-ui-success'>
                                    <Check className='h-4 w-4' />
                                </span>
                                Uploaded
                            </div>
                            <div className='grid place-items-center rounded-lg border border-ui-border bg-ui-raised p-2'>
                                <Image alt='Uploaded image' src={url} height={300} width={348} className='max-h-[360px] w-auto rounded-lg object-contain' />
                            </div>
                            <button
                                type='button'
                                onClick={() => copy({ text: url, setDidCopy })}
                                className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${didCopy === true ? 'border-ui-success/25 bg-ui-success/10 text-ui-success' : 'border-ui-border bg-ui-raised text-ui-muted hover:border-ui-primary hover:text-ui-text'}`}
                            >
                                <LinkIcon className='h-4 w-4 shrink-0' />
                                <span className='min-w-0 truncate'>{url}</span>
                            </button>
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={handleReset}
                        className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'
                    >
                        <RotateCcw className='h-4 w-4' />
                        Upload another
                    </button>
                </div>
            </section>
        )
    }

    return (
        <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='w-full max-w-4xl'>
                <div className='mb-6 grid gap-2'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Personal archive</p>
                    <h1 className='text-3xl font-semibold tracking-normal md:text-4xl'>Upload media</h1>
                    <p className='max-w-2xl text-sm leading-6 text-ui-muted'>A small media utility for quick screenshots, previews, and shareable assets.</p>
                </div>
                <Upload
                    url={url}
                    setUrl={setUrl}
                    setFile={setFile}
                    preview={preview}
                    setPreview={setPreview}
                />
                {file && preview && <Preview
                    url={preview}
                    file={file}
                    setFile={setFile}
                    setPreview={setPreview}
                    setUrl={setUrl}
                />}
            </div>
        </section>
    )
}
