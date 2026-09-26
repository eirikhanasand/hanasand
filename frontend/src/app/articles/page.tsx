import type { Metadata } from 'next'
import Articles from '@/components/articles/articles'
import { buildRouteMetadata } from '../seo'

export const dynamic = 'force-static'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Articles',
    description: 'Browse articles, notes, and longer-form writing published on Hanasand.',
    path: '/articles',
    keywords: ['articles', 'blog', 'hanasand writing'],
})

export default function Page() {
    return (
        <div className='h-full grid relative'>
            <Articles recent backfill={false} />
        </div>
    )
}
