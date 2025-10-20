import Link from 'next/link'

export default function DashboardArticle({ article }: { article: Article }) {
    return (
        <Link href={`/dashboard/articles/${article.id}`} className='grid p-2 bg-light rounded-lg'>
            <h1 key={article.id}>{article.title}</h1>
        </Link>
    )
}
