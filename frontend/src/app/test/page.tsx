import LinkPageClient from './pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Service Check',
    description: 'Create a permitted endpoint check and share a Hanasand result link.',
    path: '/test',
    keywords: ['service check', 'endpoint test', 'hanasand'],
})

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const created = Array.isArray(params.created) ? params.created[0] : params.created
    const id = Array.isArray(params.id) ? params.id[0] : params.id

    return (
        <main className='grid min-h-[calc(100vh-4.5rem)] w-full bg-ui-canvas px-4 py-6 text-ui-text md:px-8'>
            <div className='mx-auto grid h-full w-full max-w-6xl'>
                <LinkPageClient serverId={id} created={created} missingTestId={params.null ? id : undefined} />
            </div>
        </main>
    )
}
