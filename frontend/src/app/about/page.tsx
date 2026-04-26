import type { Metadata } from 'next'
import Article from '@/components/articles/article'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'About',
    description: 'Background, context, and project notes for Hanasand.',
    path: '/about',
    keywords: ['hanasand about', 'developer profile', 'portfolio'],
})

export default function page() {
    return (
        <div className='h-full'>
            <div className='p-16'>
                <Article id='readme' />
            </div>
        </div>
    )
}
