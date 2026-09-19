import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import GalleryPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Library',
    description: 'Browse your uploaded files and copy shareable links.',
    path: '/gallery',
    keywords: ['hanasand gallery', 'media uploads'],
})

export default function Page() {
    return <GalleryPageClient />
}
