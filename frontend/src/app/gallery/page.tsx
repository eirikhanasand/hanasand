import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import GalleryPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Gallery',
    description: 'Recent uploads and media utilities from the personal Hanasand workspace.',
    path: '/gallery',
    keywords: ['hanasand gallery', 'media uploads'],
})

export default function Page() {
    return <GalleryPageClient />
}
