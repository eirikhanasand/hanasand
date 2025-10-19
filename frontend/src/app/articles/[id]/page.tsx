import article from '@/components/articles/article'

type PageProps = {
    params: Promise<{ id: string }>
}

export default async function page({ params }: PageProps) {
    const id = (await params).id
    return article({ id })
}
