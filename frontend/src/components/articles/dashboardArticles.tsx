import Link from 'next/link'
import DashboardArticle from './dashboardArticle'
import { Plus } from 'lucide-react'
import fetchArticles from '@/utils/articles/fetchArticles'
import { DashboardPanel } from '@/components/dashboard/ui'

export default async function DashboardArticles() {
    const articles = await fetchArticles()
    const list = articles as Article[]

    return (
        <DashboardPanel className='grid h-fit min-w-0 w-full gap-2 p-4'>
            <div className='flex items-center justify-between gap-3'>
                <h1 className='text-base font-medium text-bright/90'>Articles</h1>
                <Link href='/dashboard/articles/create' className='flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-bright/70 hover:bg-white/10'>
                    <Plus className='h-4 w-4' />
                    Create
                </Link>
            </div>
            {list.length ? list.map((article) => <DashboardArticle key={article.id} article={article} />) : (
                <p className='rounded-lg border border-dashed border-white/10 p-3 text-sm text-bright/42'>No articles yet.</p>
            )}
        </DashboardPanel>
    )
}
