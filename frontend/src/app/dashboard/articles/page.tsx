import DashboardArticle from '@/components/articles/dashboardArticle'
import fetchArticles from '@/utils/articles/fetchArticles'

export default async function Page() {
    const articles = await fetchArticles()

    return (
        <div className='grid gap-5 py-4'>
            <div>
                <p className='text-xs uppercase tracking-[0.35em] text-orange-200/70'>Publishing</p>
                <h1 className='mt-2 text-3xl font-semibold tracking-[-0.04em] text-bright'>Articles</h1>
            </div>
            <section className='glass-card rounded-[1.4rem] p-5'>
                <div className='grid gap-2'>
                    {(articles as Article[]).map((article) => <DashboardArticle key={article.id} article={article} />)}
                </div>
            </section>
        </div>
    )
}
