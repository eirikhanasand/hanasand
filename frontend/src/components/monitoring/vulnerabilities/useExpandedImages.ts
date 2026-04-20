import { useEffect, useMemo, useState } from 'react'
import type { ImageList } from './types'

export default function useExpandedImages(images: ImageList) {
    const [expandedImages, setExpandedImages] = useState<string[]>([])
    const areAllExpanded = useMemo(
        () => images.length > 0 && expandedImages.length === images.length,
        [expandedImages.length, images.length]
    )

    useEffect(() => {
        setExpandedImages(prev => prev.filter(name => images.some(image => image.image === name)))
    }, [images])

    function toggleImage(imageName: string) {
        setExpandedImages(prev => prev.includes(imageName) ? prev.filter(name => name !== imageName) : [...prev, imageName])
    }

    function toggleExpandAll() {
        setExpandedImages(prev => prev.length === images.length ? [] : images.map(image => image.image))
    }

    return { expandedImages, areAllExpanded, toggleImage, toggleExpandAll }
}
