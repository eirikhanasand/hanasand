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

export default function Page() {
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
            <section className='grid min-h-[90.5vh] w-full place-items-center px-4 py-8 md:px-10'>
                <div className='grid w-full max-w-xl gap-3'>
                    <div className='rounded-xl border border-white/10 bg-dark/70 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-md'>
                        <div className='grid gap-4'>
                            <div className='flex items-center gap-2 text-sm font-medium text-emerald-100/78'>
                                <span className='grid h-7 w-7 place-items-center rounded-lg bg-emerald-400/12 text-emerald-200'>
                                    <Check className='h-4 w-4' />
                                </span>
                                Uploaded
                            </div>
                            <div className='grid place-items-center rounded-lg border border-white/8 bg-black/20 p-2'>
                                <Image alt='Uploaded image' src={url} height={300} width={348} className='max-h-[360px] w-auto rounded-lg object-contain' />
                            </div>
                            <button
                                type='button'
                                onClick={() => copy({ text: url, setDidCopy })}
                                className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${didCopy === true ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-white/[0.045] text-bright/72 hover:bg-white/7 hover:text-bright'}`}
                            >
                                <LinkIcon className='h-4 w-4 shrink-0' />
                                <span className='min-w-0 truncate'>{url}</span>
                            </button>
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={handleReset}
                        className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-4 text-sm font-medium text-bright/68 transition hover:bg-white/7 hover:text-bright'
                    >
                        <RotateCcw className='h-4 w-4' />
                        Upload another
                    </button>
                </div>
            </section>
        )
    }

    return (
        <section className='grid min-h-[90.5vh] w-full place-items-center px-4 py-8 md:px-10'>
            <div className='w-full max-w-4xl'>
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
