import DashboardArticle from '@/components/articles/dashboardArticle'
import fetchArticles from '@/utils/articles/fetchArticles'

export default async function Page() {
    const articles = await fetchArticles()

    return (
        <div className="h-full">
            <div className="p-16">
                <div className='grid w-full p-2 bg-dark rounded-lg gap-2'>
                    <h1 className='font-semibold text-lg'>Articles</h1>
                    {(articles as Article[]).map((article) => <DashboardArticle key={article.id} article={article} />)}
                </div>
            </div>
        </div>
    )
}
