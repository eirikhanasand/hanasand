import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import UploadPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Upload Media',
    description: 'Upload screenshots, previews, and shareable media assets in Hanasand.',
    path: '/upload',
    keywords: ['hanasand upload', 'media upload'],
})

export default function Page() {
    return <UploadPageClient />
}
