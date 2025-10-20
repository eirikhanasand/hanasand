import DashboardArticle from '@/components/articles/dashboardArticle'
import fetchArticles from '@/utils/articles/fetchArticles'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const articles = await fetchArticles()

    if (!name) {
        redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    return (
        <div className="h-full">
            <div className="p-16 grid gap-2">
                <div className='grid w-full p-2 bg-dark rounded-lg'>
                    <h1 className='text-2xl font-semibold'>Welcome back {name}!</h1>
                </div>
                <div className='grid w-full p-2 bg-dark rounded-lg gap-2'>
                    <h1 className='font-semibold text-lg'>Articles</h1>
                    {(articles as Article[]).map((article) => <DashboardArticle key={article.id} article={article} />)}
                </div>
            </div>
        </div>
    )
}
