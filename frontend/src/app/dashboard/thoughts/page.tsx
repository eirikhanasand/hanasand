import DashboardThought from '@/components/thoughts/dashboardThought'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import { BrainCircuit, Clock3, Plus, Radio, UserRound } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const thoughts = await fetchThoughts()
    const latest = [...thoughts].sort((a, b) => dateMs(b.updated_at || b.created_at) - dateMs(a.updated_at || a.created_at))[0]
    const authors = new Set(thoughts.map((thought) => thought.created_by).filter(Boolean))

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Notebook'
                title='Thoughts'
                description='Working observations, recent movement, and real note rows.'
                actions={
                    <Link href='/dashboard/thoughts/create' className='flex h-9 items-center gap-2 rounded-lg bg-ui-primary px-3.5 text-sm font-medium text-ui-text transition hover:opacity-90'>
                        <Plus className='h-4 w-4' />
                        <span>Create</span>
                    </Link>
                }
            />

            <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <NotebookMetric icon={<BrainCircuit className='h-4 w-4' />} label='Thought rows' value={String(thoughts.length)} detail='real notes returned by the thoughts API' tone={thoughts.length ? 'ok' : 'watch'} />
                <NotebookMetric icon={<Clock3 className='h-4 w-4' />} label='Latest movement' value={latest ? shortDate(latest.updated_at || latest.created_at) : 'Open'} detail={latest?.title || 'Create the first thought'} tone={latest ? 'ok' : 'neutral'} />
                <NotebookMetric icon={<UserRound className='h-4 w-4' />} label='Authors' value={String(authors.size)} detail='contributors represented in this notebook' tone={authors.size ? 'ok' : 'neutral'} />
                <NotebookMetric icon={<Radio className='h-4 w-4' />} label='Notebook' value={thoughts.length ? 'Live' : 'Ready'} detail='new observations stream in immediately' tone={thoughts.length ? 'ok' : 'watch'} />
            </section>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Notebook queue</h2>
                        <p className='mt-1 text-sm text-ui-muted'>{thoughts.length ? 'Newest observations are streaming here.' : 'The notebook is open.'}</p>
                    </div>
                    <span className='rounded-full border border-ui-primary/35 bg-ui-primary/10 px-3 py-1 text-xs font-semibold text-ui-text'>
                        {thoughts.length} rows
                    </span>
                </div>
                <div className='grid gap-1 p-3'>
                    {thoughts.length ? thoughts.map((thought) => <DashboardThought key={thought.id} thought={thought} />) : (
                        <div className='rounded-lg border border-dashed border-ui-border bg-ui-canvas p-4 text-sm text-ui-muted'>
                            Notebook queue is clear. Create a thought to start the stream.
                        </div>
                    )}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function NotebookMetric({ icon, label, value, detail, tone }: { icon: ReactNode, label: string, value: string, detail: string, tone: 'ok' | 'watch' | 'neutral' }) {
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

function dateMs(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function shortDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Synced'
    return date.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
