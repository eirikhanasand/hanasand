import Link from 'next/link'
import { Clock3, FileCode2, LockKeyhole, Plus, Radio, Text } from 'lucide-react'
import DashboardShare from './dashboardShare'
import { getUserShares } from '@/utils/share/getUserShares'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPanel } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'
import type { ReactNode } from 'react'

export default async function Shares() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const shares = await getUserShares({ id, token })
    const shareRows = typeof shares === 'string' ? [] : shares as Share[]
    const latestShare = [...shareRows].sort((a, b) => dateMs(b.timestamp) - dateMs(a.timestamp))[0]
    const lockedCount = shareRows.filter(share => share.locked).length
    const totalWords = shareRows.reduce((sum, share) => sum + (share.wordCount || 0), 0)

    return (
        <div className='grid gap-3'>
            <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <ShareMetric icon={<FileCode2 className='h-4 w-4' />} label='Shares' value={String(shareRows.length)} detail='total shares' tone={shareRows.length ? 'ok' : 'watch'} />
                <ShareMetric icon={<LockKeyhole className='h-4 w-4' />} label='Locked' value={String(lockedCount)} detail={`${Math.max(shareRows.length - lockedCount, 0)} unlocked`} tone={lockedCount ? 'watch' : 'ok'} />
                <ShareMetric icon={<Text className='h-4 w-4' />} label='Words' value={totalWords.toLocaleString('en-US')} detail='total words shared' tone='neutral' />
                <ShareMetric icon={<Clock3 className='h-4 w-4' />} label='Latest share' value={latestShare ? shortDate(latestShare.timestamp) : 'None'} detail={latestShare?.alias || latestShare?.path || 'No shares yet'} tone={latestShare ? 'ok' : 'neutral'} />
            </section>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-start justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                    <div>
                        <div className='flex items-center gap-2'>
                            <Radio className='h-4 w-4 text-ui-primary' />
                            <h2 className='text-base font-semibold text-ui-text'>Shares</h2>
                        </div>
                        <p className='mt-1 text-sm text-ui-muted'>
                            {typeof shares === 'string' ? 'Could not load shares.' : `${shareRows.length} share${shareRows.length === 1 ? '' : 's'}.`}
                        </p>
                    </div>
                    <Link prefetch={false} href='/s' className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10'>
                        <Plus className='h-4 w-4' />
                        <span>Create share</span>
                    </Link>
                </div>
                <div className='grid gap-1 p-3'>
                    {typeof shares === 'string'
                        ? <ErrorNotice compact message={shares} />
                        : shareRows.length
                            ? shareRows.map((share) => <DashboardShare key={share.id} share={share} />)
                            : <p className='rounded-lg border border-dashed border-ui-border bg-ui-canvas p-4 text-sm text-ui-muted'>No shares.</p>}
                </div>
            </DashboardPanel>
        </div>
    )
}

function ShareMetric({ icon, label, value, detail, tone }: { icon: ReactNode, label: string, value: string, detail: string, tone: 'ok' | 'watch' | 'neutral' }) {
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
