'use client'

import Preview from '@/components/upload/preview'
import Upload from '@/components/upload/upload'
import config from '@/config'
import { DoorOpen, UploadIcon, LinkIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import copy from '@/utils/copy'

export default function Page() {
    const [url, setUrl] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [didCopy, setDidCopy] = useState<string | boolean>(false)
    const uploadClasses = (!file || !preview) && 'py-40 px-15 h-[30vh md:p-60'
    const previewClasses = preview && 'p-5 md:p-10 md:px-[33.333vw]'
    const isUploaded = url.includes(config.url.cdn)

    function handleReset() {
        setUrl('')
        setFile(null)
        setPreview(null)
    }

    useEffect(() => {
        setTimeout(() => {
            setDidCopy(false)
        }, 1000)
    }, [didCopy])

    if (isUploaded) {
        return (
            <div className={`min-h-[93.5vh] w-full md:h-full grid gap-2 place-items-center ${uploadClasses} ${previewClasses} relative`}>
                <div>
                    <div className='bg-dark text-foreground p-4 rounded-lg w-full space-y-4 grid place-items-center'>
                        <div className='grid place-items-center'>
                            <Image alt='Uploaded image' src={url} height={300} width={348} className='rounded-lg' />
                        </div>
                        <div onClick={() => copy({ text: url, setDidCopy })} className='bg-light flex rounded-lg gap-2 p-2 px-4 cursor-pointer'>
                            <LinkIcon className={didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-gray-200' : 'stroke-red-500'} height={18} width={18} />
                            <h1 className='text-gray-200'>{url}</h1>
                        </div>
                    </div>
                    <div className='text-foreground rounded-lg grid grid-cols-2 gap-2 mt-2'>
                        <Link href='/' className='rounded-lg hover:bg-[#6464641a] cursor-pointer flex justify-center items-center bg-dark gap-2 p-2'>
                            <DoorOpen className='stroke-gray-200' />
                            <h1 className='text-gray-200'>Leave</h1>
                        </Link>
                        <div onClick={handleReset} className='rounded-lg hover:bg-[#6464641a] cursor-pointer flex justify-center items-center bg-dark gap-2 p-2'>
                            <UploadIcon className='stroke-gray-200' />
                            <h1 className='text-gray-200'>Upload Another</h1>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-[93.5vh] w-full md:h-full grid gap-2 place-items-center ${uploadClasses} ${previewClasses}`}>
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
