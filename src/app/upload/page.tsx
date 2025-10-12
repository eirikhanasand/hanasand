'use client'

import Preview from '@/components/upload/preview'
import Upload from '@/components/upload/upload'
import handleUpload from '@/utils/files/handleUpload'
import { useState } from 'react'

export default function Page() {
    const [url, setUrl] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const uploadClasses = (!file || !preview) && 'py-40 px-15 h-[30vh md:p-60'
    const previewClasses = preview && 'p-5 md:p-10 md:px-[33.333vw]'

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
                onUpload={handleUpload}
            />}
        </div>
    )
}
