import Link from 'next/link'
import DashboardArticle from './dashboardArticle'
import { Plus } from 'lucide-react'
import fetchArticles from '@/utils/articles/fetchArticles'

export default async function DashboardArticles() {
    const articles = await fetchArticles()

    return (
        <section className='grid h-fit min-w-0 w-full gap-2 rounded-xl border border-white/10 bg-white/4 p-4'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Articles</h1>
                <Link href='/dashboard/articles/create' className='flex gap-2 rounded-lg p-0.75 px-5 hover:outline-green-500/35 outline-1 outline-dark cursor-pointer hover:bg-green-500/20'>
                    <Plus />
                    <h1 className='font-semibold select-none'>Create</h1>
                </Link>
            </div>
            {(articles as Article[]).map((article) => <DashboardArticle key={article.id} article={article} />)}
        </section>
    )
}
