import Link from 'next/link'
import DashboardArticle from './dashboardArticle'
import { Plus } from 'lucide-react'
import fetchArticles from '@/utils/articles/fetchArticles'

export default async function DashboardArticles() {
    const articles = await fetchArticles()

    return (
        <div className='grid w-full p-2 outline-1 outline-dark rounded-lg gap-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Articles</h1>
                <Link href='/dashboard/articles/create' className='flex gap-2 rounded-lg p-2 px-6 border-2 border-normal cursor-pointer hover:bg-green-500'>
                    <Plus />
                    <h1 className='font-semibold'>Create</h1>
                </Link>
            </div>
            {(articles as Article[]).map((article) => <DashboardArticle key={article.id} article={article} />)}
        </div>
    )
}
