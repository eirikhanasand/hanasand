import Link from 'next/link'
import { Plus } from 'lucide-react'
import fetchArticles from '@/utils/articles/fetchArticles'
import DashboardArticle from '../articles/dashboardArticle'

export default async function DashboardVms() {
    const articles = await fetchArticles()

    return (
        <div className='grid h-fit w-full p-2 outline-1 outline-dark rounded-lg gap-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Virtual Machines</h1>
                <Link href='/s' className='flex gap-2 rounded-lg p-[3px] px-5 hover:outline-green-500/35 outline-1 outline-dark cursor-pointer hover:bg-green-500/20'>
                    <Plus />
                    <h1 className='font-semibold'>Create</h1>
                </Link>
            </div>
            {(articles as Article[]).map((article) => <DashboardArticle key={article.id} article={article} />)}
        </div>
    )
}
