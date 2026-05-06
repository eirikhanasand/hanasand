type ImagePreviewProps = {
    file: File
    url: string
}

export default function ImagePreview({file, url}: ImagePreviewProps) {
    if (file?.type.startsWith('image/')) {
        return (
            <img
                src={url}
                alt='Preview'
                className='max-h-[520px] w-auto max-w-full rounded-lg object-contain shadow-[0_18px_60px_rgba(0,0,0,0.24)]'
            />
        )
    }
    return (
        <video
            src={url}
            controls
            className='max-h-[520px] w-auto max-w-full rounded-lg shadow-[0_18px_60px_rgba(0,0,0,0.24)]'
        />
    )
}
