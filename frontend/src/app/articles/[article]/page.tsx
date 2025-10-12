import article from '@/components/articles/article'

type PageProps = {
    params: Promise<{ article: string }>
}

export default async function page({ params }: PageProps) {
    const current = (await params).article
    return article({ article: current })
}
