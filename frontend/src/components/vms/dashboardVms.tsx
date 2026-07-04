import Link from 'next/link'
import { Plus } from 'lucide-react'
import fetchArticles from '@/utils/articles/fetchArticles'
import DashboardArticle from '../articles/dashboardArticle'

export default async function DashboardVms() {
    const articles = await fetchArticles()

    return (
        <div className='grid h-fit w-full gap-2 rounded-lg border border-ui-border bg-ui-panel p-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Virtual Machines</h1>
                <Link href='/s' className='flex cursor-pointer gap-2 rounded-lg border border-ui-border p-[3px] px-5 hover:border-ui-success/35 hover:bg-ui-success/10'>
                    <Plus />
                    <h1 className='font-semibold select-none'>Create</h1>
                </Link>
            </div>
            {(articles as Article[]).map((article) => <DashboardArticle key={article.id} article={article} />)}
        </div>
    )
}
