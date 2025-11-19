'use client'

import Preview from '@/components/upload/preview'
import Upload from '@/components/upload/upload'
import config from '@/config'
import { DoorOpen, UploadIcon, LinkIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import copy from '@/utils/copy'
import useClearStateAfter from '@/hooks/useClearStateAfter'

export default function Page() {
    const [url, setUrl] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const uploadClasses = (!file || !preview) && 'py-40 px-15 h-[30vh md:p-60'
    const previewClasses = preview && 'p-5 md:p-10 md:px-[33.333vw]'
    const isUploaded = url.includes(config.url.cdn)
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({ 
        initialState: false, 
        timeout: 1000, 
        onClear: () => {setDidCopy(false)} 
    })

    function handleReset() {
        setUrl('')
        setFile(null)
        setPreview(null)
    }

    if (isUploaded) {
        return (
            <div className={`min-h-[90.5vh] w-full md:h-full grid gap-2 place-items-center ${uploadClasses} ${previewClasses} relative`}>
                <div>
                    <div className='bg-dark text-foreground p-4 rounded-lg w-full space-y-4 grid place-items-center'>
                        <div className='grid place-items-center'>
                            <Image alt='Uploaded image' src={url} height={300} width={348} className='rounded-lg' />
                        </div>
                        <div onClick={() => copy({ text: url, setDidCopy })} className={`hover:scale-103 ${didCopy === true ? 'outline outline-green-500/35 bg-green-500/20' : 'bg-light'} flex rounded-lg gap-2 p-2 px-4 cursor-pointer`}>
                            <LinkIcon className={didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-bright/80' : 'stroke-red-500'} height={18} width={18} />
                            <h1 className='text-bright/80'>{url}</h1>
                        </div>
                    </div>
                    <div className='text-foreground rounded-lg grid grid-cols-2 gap-2 mt-2'>
                        <Link href='/' className='hover:scale-105 rounded-lg hover:bg-[#6464641a] cursor-pointer flex justify-center items-center bg-dark gap-2 p-2'>
                            <DoorOpen className='stroke-bright/80' />
                            <h1 className='text-bright/80'>Leave</h1>
                        </Link>
                        <div onClick={handleReset} className='hover:scale-105 rounded-lg hover:bg-[#6464641a] cursor-pointer flex justify-center items-center bg-dark gap-2 p-2'>
                            <UploadIcon className='stroke-bright/80' />
                            <h1 className='text-bright/80'>Upload Another</h1>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-[90.5vh] w-full md:h-full grid gap-2 place-items-center ${uploadClasses} ${previewClasses}`}>
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
    )
}
