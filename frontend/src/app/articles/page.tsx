import type { Metadata } from 'next'
import Articles from '@/components/articles/articles'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Articles',
    description: 'Browse articles, notes, and longer-form writing published on Hanasand.',
    path: '/articles',
    keywords: ['articles', 'blog', 'hanasand writing'],
})

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const error = Array.isArray(params.error) ? params.error[0] : params.error
    const errorPath = Array.isArray(params.path) ? params.path[0] : params.path

    return (
        <div className='h-full grid relative'>
            <Articles recent error={error} errorPath={errorPath} backfill={false} />
        </div>
    )
}
