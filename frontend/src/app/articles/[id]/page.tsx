import type { Metadata } from 'next'
import article from '@/components/articles/article'
import { buildRouteMetadata, humanizeSlug } from '../../seo'

type PageProps = {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const id = (await params).id
    const title = humanizeSlug(id || 'Article')

    return buildRouteMetadata({
        title,
        description: `Read ${title} on Hanasand.`,
        path: `/articles/${id}`,
        keywords: ['article', 'hanasand article', title.toLowerCase()],
    })
}

export default async function page({ params }: PageProps) {
    const id = (await params).id
    return article({ id })
}
