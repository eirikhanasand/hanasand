import { ArticleAnalyticsPanel, ArticleAnalyticsProvider, ArticleAnalyticsToggle } from '@/components/articles/dashboardAnalytics'
import DashboardArticlesTable from '@/components/articles/dashboardArticlesTable'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import fetchWorkspaceContent from '@/utils/organizations/fetchWorkspaceContent'
import { Clock3, FileText, Plus, Radio, Timer } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export default async function Page() {
    const articles = await fetchWorkspaceContent<Article>('articles')
    const latest = [...articles].sort((a, b) => dateMs(b.modified || b.created) - dateMs(a.modified || a.created))[0]
    const totalWords = articles.reduce((sum, article) => sum + (article.metadata?.wordCount || countWords(article.content)), 0)
    const totalMinutes = articles.reduce((sum, article) => sum + (article.metadata?.estimatedMinutes || 0), 0)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Publishing'
                title='Articles'
                description='Published articles and drafts.'
                actions={
                    <Link href='/content/articles/create' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-text transition hover:opacity-90'>
                        <Plus className='h-4 w-4' />
                        Create article
                    </Link>
                }
            />

            {!articles.length ? <DashboardPanel className='grid min-h-80 place-items-center border-ui-border bg-ui-panel p-8 text-center'>
                <div className='max-w-md'>
                    <div className='mx-auto grid h-12 w-12 place-items-center rounded-full bg-ui-primary/10 text-ui-primary'>
                        <FileText className='h-6 w-6' />
                    </div>
                    <h2 className='mt-4 text-xl font-semibold text-ui-text'>Publish your first article</h2>
                    <p className='mt-2 text-sm leading-6 text-ui-muted'>Turn research into a clear public update and start the editorial queue.</p>
                    <Link href='/content/articles/create' className='mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas'>
                        <Plus className='h-4 w-4' />
                        Create your first article
                    </Link>
                </div>
            </DashboardPanel> : null}

            {articles.length ? <ArticleAnalyticsProvider>
                <ArticleAnalyticsPanel>
                    <EditorialMetric icon={<FileText className='h-4 w-4' />} label='Published' value={String(articles.length)} detail='articles' tone={articles.length ? 'ok' : 'watch'} />
                    <EditorialMetric icon={<Clock3 className='h-4 w-4' />} label='Latest edit' value={latest ? shortDate(latest.modified || latest.created) : 'Ready'} detail={latest?.title || 'Create the first article'} tone={latest ? 'ok' : 'neutral'} />
                    <EditorialMetric icon={<Timer className='h-4 w-4' />} label='Reading time' value={totalMinutes ? `${totalMinutes} min` : 'Metering'} detail={`${totalWords.toLocaleString('en-US')} words`} tone='neutral' />
                    <EditorialMetric icon={<Radio className='h-4 w-4' />} label='Publishing' value={articles.length ? 'Live' : 'Open'} tone={articles.length ? 'ok' : 'watch'} />
                </ArticleAnalyticsPanel>

                <DashboardPanel className='overflow-hidden rounded-md border-ui-border bg-ui-raised/20 p-0'>
                    <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Articles</h2>
                            <p className='mt-1 text-sm text-ui-muted'>{articles.length ? 'Published and draft articles.' : 'Create an article to get started.'}</p>
                        </div>
                        <div className='flex items-center gap-2'>
                            <span className='rounded-md border border-ui-border bg-ui-raised px-3 py-1 text-xs font-semibold text-ui-muted'>
                                {articles.length} {articles.length === 1 ? 'Article' : 'Articles'}
                            </span>
                            <ArticleAnalyticsToggle />
                        </div>
                    </div>
                    {articles.length
                        ? <DashboardArticlesTable articles={articles} />
                        : <div className='p-4 text-sm text-ui-muted'>No articles yet. Create an article to get started.</div>}
                </DashboardPanel>
            </ArticleAnalyticsProvider> : null}
        </DashboardPage>
    )
}

function EditorialMetric({ icon, label, value, detail, tone }: { icon: ReactNode, label: string, value: string, detail?: string, tone: 'ok' | 'watch' | 'neutral' }) {
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
            {detail ? <p className='mt-2 line-clamp-2 text-sm leading-5 text-ui-muted'>{detail}</p> : null}
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
    return date.toLocaleString('en', { year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
