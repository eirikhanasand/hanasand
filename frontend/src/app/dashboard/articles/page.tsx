import DashboardArticle from '@/components/articles/dashboardArticle'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import fetchArticles from '@/utils/articles/fetchArticles'

export default async function Page() {
    const articles = await fetchArticles()

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Publishing'
                title='Articles'
                description='Draft and maintain the public writing that supports product updates, technical notes, and customer-facing research.'
            />
            <DashboardPanel className='p-4'>
                <div className='grid gap-2'>
                    {(articles as Article[]).map((article) => <DashboardArticle key={article.id} article={article} />)}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}
