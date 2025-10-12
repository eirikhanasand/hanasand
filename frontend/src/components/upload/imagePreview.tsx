import Image from 'next/image'

type ImagePreviewProps = {
    file: File
    url: string
}

export default function ImagePreview({file, url}: ImagePreviewProps) {
    if (file?.type.startsWith("image/")) {
        return (
            <Image
                src={url}
                alt="Preview"
                width={300}
                height={300}
                className="max-w-xs rounded-lg shadow-md"
            />
        )
    }
    return (
        <video
            src={url}
            controls
            className="max-w-xs rounded-lg shadow-md"
        />
    )
}
