import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import UploadPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Shareable Media Utility',
    description: 'Upload public screenshots, previews, and shareable media assets in Hanasand.',
    path: '/upload',
    keywords: ['hanasand media utility', 'shareable media upload'],
})

export default function Page() {
    return <UploadPageClient />
}
