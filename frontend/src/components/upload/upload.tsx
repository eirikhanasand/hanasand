import { Camera, ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useCallback } from 'react'

type UploadProps = {
    url: string
    setUrl: Dispatch<SetStateAction<string>>
    setFile: Dispatch<SetStateAction<File | null>>
    preview: string | null
    setPreview: Dispatch<SetStateAction<string | null>>
}

export default function Upload({ url, setUrl, setFile, preview, setPreview }: UploadProps) {
    const handleFile = useCallback((file: File) => {
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
        const droppedFile = e.dataTransfer.files?.[0]
        if (droppedFile) handleFile(droppedFile)
    }

    function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
    }

    if (preview) {
        return <></>
    }

    return (
        <div className='grid md:grid-cols-2 w-full spawn rounded-lg overflow-hidden'>
            <div
                className='hidden md:grid w-full h-full place-items-center bg-dark'
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <h1 className='rounded-lg border-2 border-dashed border-amber-700 p-3 px-10 cursor-pointer'>
                    Drop image here
                </h1>
            </div>
            <div className='w-full h-full grid place-items-center bg-light'>
                <div className='flex flex-col items-center gap-4'>
                    <label
                        htmlFor="fileInput"
                        className="flex gap-4 items-center cursor-pointer hover:opacity-80 active:scale-[0.98] transition"
                    >
                        <ImageIcon />
                        <h1>Choose Photo / Video</h1>
                        <input
                            id="fileInput"
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </label>
                    <Or />
                    <label
                        htmlFor="cameraInput"
                        className="md:hidden flex gap-4 items-center cursor-pointer hover:opacity-80 active:scale-[0.98] transition"
                    >
                        <Camera />
                        <h1>Capture the moment</h1>
                        <input
                            id="cameraInput"
                            type="file"
                            accept="image/*,video/*"
                            capture="environment"
                            className="hidden"
                        />
                    </label>
                    <Or className='md:hidden' />
                    <input
                        placeholder='Paste image or url'
                        value={url}
                        onChange={(e) => setUrl((e.target.value).toUpperCase())}
                        className='bg-darker w-full rounded-md border-[1px] border-[rgb(44,44,44)] px-2 py-1 focus:outline-hidden'
                    />
                </div>
                <Link href='/gallery' className='bg-extralight p-2 px-10 rounded-lg'><h1>My uploads</h1></Link>
            </div>
        </div>
    )
}

function Or({className}: {className?: string}) {
    return (
        <div className={`flex gap-2 ${className}`}>
            <h1 className='text-extralight'>────</h1>
            <h1>or</h1>
            <h1 className='text-extralight'>────</h1>
        </div>
    )
}
