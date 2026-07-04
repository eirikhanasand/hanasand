import DashboardArticle from '@/components/articles/dashboardArticle'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import fetchArticles from '@/utils/articles/fetchArticles'
import { Clock3, FileText, Plus, Radio, Timer } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export default async function Page() {
    const articles = await fetchArticles() as Article[]
    const latest = [...articles].sort((a, b) => dateMs(b.modified || b.created) - dateMs(a.modified || a.created))[0]
    const totalWords = articles.reduce((sum, article) => sum + (article.metadata?.wordCount || countWords(article.content)), 0)
    const totalMinutes = articles.reduce((sum, article) => sum + (article.metadata?.estimatedMinutes || 0), 0)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Publishing'
                title='Articles'
                description='Editorial queue, latest movement, and published research rows.'
                actions={
                    <Link href='/dashboard/articles/create' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-text transition hover:opacity-90'>
                        <Plus className='h-4 w-4' />
                        Create article
                    </Link>
                }
            />

            <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <EditorialMetric icon={<FileText className='h-4 w-4' />} label='Published' value={String(articles.length)} detail='articles indexed for the public site' tone={articles.length ? 'ok' : 'watch'} />
                <EditorialMetric icon={<Clock3 className='h-4 w-4' />} label='Latest edit' value={latest ? shortDate(latest.modified || latest.created) : 'Ready'} detail={latest?.title || 'Create the first article'} tone={latest ? 'ok' : 'neutral'} />
                <EditorialMetric icon={<Timer className='h-4 w-4' />} label='Reading time' value={totalMinutes ? `${totalMinutes} min` : 'Metering'} detail={`${totalWords.toLocaleString('en-US')} indexed words`} tone='neutral' />
                <EditorialMetric icon={<Radio className='h-4 w-4' />} label='Publishing' value={articles.length ? 'Live' : 'Open'} detail='new drafts and deletes update this queue' tone={articles.length ? 'ok' : 'watch'} />
            </section>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Editorial queue</h2>
                        <p className='mt-1 text-sm text-ui-muted'>{articles.length ? 'Newest published and draft rows are streaming here.' : 'The writing queue is open.'}</p>
                    </div>
                    <span className='rounded-full border border-ui-primary/35 bg-ui-primary/10 px-3 py-1 text-xs font-semibold text-ui-text'>
                        {articles.length} rows
                    </span>
                </div>
                <div className='grid gap-1 p-3'>
                    {articles.length ? articles.map((article) => <DashboardArticle key={article.id} article={article} />) : (
                        <div className='rounded-lg border border-dashed border-ui-border bg-ui-canvas p-4 text-sm text-ui-muted'>
                            Editorial queue is clear. Create an article to start the stream.
                        </div>
                    )}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function EditorialMetric({ icon, label, value, detail, tone }: { icon: ReactNode, label: string, value: string, detail: string, tone: 'ok' | 'watch' | 'neutral' }) {
    const dot = tone === 'ok'
        ? 'bg-ui-success shadow-[0_0_14px_rgba(49,196,141,0.65)]'
        : tone === 'watch'
            ? 'bg-ui-warning shadow-[0_0_14px_rgba(246,180,95,0.45)]'
            : 'bg-ui-primary shadow-[0_0_14px_rgba(157,180,255,0.45)]'
    const text = tone === 'ok' ? 'text-ui-success' : tone === 'watch' ? 'text-ui-warning' : 'text-ui-primary'

    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3 text-sm text-ui-muted'>
                <span>{label}</span>
                <span className={text}>{icon}</span>
            </div>
            <div className='mt-3 flex items-center gap-2 text-2xl font-semibold text-ui-text'>
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {value}
            </div>
            <p className='mt-2 line-clamp-2 text-sm leading-5 text-ui-muted'>{detail}</p>
        </DashboardPanel>
    )
}

function countWords(value: string) {
    return value.trim() ? value.trim().split(/\s+/).length : 0
}

function dateMs(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function shortDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Synced'
    return date.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
