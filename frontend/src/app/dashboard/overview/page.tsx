import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Activity, AlertTriangle, Radio, Radar, Search, ShieldAlert } from 'lucide-react'
import { getMonitoringOverview } from '@/utils/monitoring/data'
import getStatus from '@/utils/status/getStatus'
import { toPublicServiceStatus } from '@/utils/status/publicStatus'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Overview',
    description: 'Customer overview for monitored domains, breach mentions, traffic, vulnerabilities, and service health.',
}

export default async function Page() {
    const token = (await cookies()).get('access_token')?.value

    if (!token) {
        redirect('/logout?path=/login%3Fpath%3D/dashboard/overview%26expired=true')
    }

    const [overview, status] = await Promise.all([
        getMonitoringOverview(),
        getStatus(),
    ])
    const publicStatus = toPublicServiceStatus(status)
    const serviceIssues = publicStatus.checks.filter(check => check.status !== 'up')
    const slowestChecks = [...publicStatus.checks].sort((a, b) => (b.latency_ms || 0) - (a.latency_ms || 0)).slice(0, 5)
    const actions = [
        overview.criticalVulnerabilities ? {
            href: '/dashboard/vulnerabilities',
            title: 'Fix critical vulnerabilities',
            detail: `${formatNumber(overview.criticalVulnerabilities)} critical findings across monitored images.`,
            tone: 'bad' as const,
        } : null,
        overview.activeDomains ? {
            href: '/monitor',
            title: 'Review monitored domains',
            detail: `${formatNumber(overview.activeDomains)} domains have recent traffic or breach monitoring data.`,
            tone: 'ok' as const,
        } : null,
        serviceIssues.length ? {
            href: '/status',
            title: 'Check service health',
            detail: `${serviceIssues.length} public check${serviceIssues.length === 1 ? '' : 's'} degraded or down.`,
            tone: 'watch' as const,
        } : null,
    ].filter(Boolean)

    return (
        <DashboardPage>
            <DashboardHeader
                title='Overview'
                description='Customer-facing status for the domains, traffic, breach mentions, vulnerabilities, and service checks that matter now.'
                eyebrow='Dashboard'
            />

            <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                <div className='flex items-center justify-between gap-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Traffic</h2>
                        <p className='mt-1 text-sm text-ui-muted'>Requests grouped by clear time periods.</p>
                    </div>
                    <Activity className={`h-4 w-4 ${overview.requestsToday ? 'text-ui-success' : 'text-ui-warning'}`} />
                </div>
                <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                    <Stat title='Today' value={formatNumber(overview.requestsToday)} />
                    <Stat title='This week' value={formatNumber(overview.requestsThisWeek)} />
                    <Stat title='This month' value={formatNumber(overview.requestsThisMonth)} />
                    <Stat title='Total' value={formatNumber(overview.requestsTotal)} />
                </div>
            </DashboardPanel>

            <div className='grid gap-3 md:grid-cols-3'>
                <OverviewCard href='/monitor' title='Domains watched' value={formatNumber(overview.activeDomains)} detail='open the monitored domain list' icon={<Radar className='h-4 w-4' />} tone={overview.activeDomains ? 'ok' : 'watch'} />
                <OverviewCard title='Critical vulnerabilities' value={formatNumber(overview.criticalVulnerabilities)} detail={`${formatNumber(overview.totalVulnerabilities)} total findings across images`} icon={<ShieldAlert className='h-4 w-4' />} tone={overview.criticalVulnerabilities ? 'bad' : 'ok'} />
                <OverviewCard title='Scanner' value={overview.scanRunning ? 'running' : formatNumber(overview.imagesScanned)} detail={overview.scanRunning ? 'image scan is active now' : 'monitored images'} icon={<Search className='h-4 w-4' />} tone={overview.scanRunning ? 'watch' : overview.imagesScanned ? 'ok' : 'neutral'} />
            </div>

            <div className='grid gap-3 xl:grid-cols-[1fr_0.9fr]'>
                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='flex items-center justify-between border-b border-ui-border px-4 py-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Needs attention</h2>
                            <p className='mt-1 text-sm text-ui-muted'>Only rows with a clear customer action appear here.</p>
                        </div>
                        <AlertTriangle className={`h-4 w-4 ${actions.length ? 'text-ui-warning' : 'text-ui-success'}`} />
                    </div>
                    <div className='divide-y divide-ui-border'>
                        {actions.length ? actions.map(action => action && (
                            <Link key={action.href} href={action.href} className='grid gap-2 px-4 py-3 transition hover:bg-ui-raised md:grid-cols-[1fr_auto] md:items-center'>
                                <div>
                                    <p className='font-semibold text-ui-text'>{action.title}</p>
                                    <p className='mt-1 text-sm text-ui-muted'>{action.detail}</p>
                                </div>
                                <span className={`h-2 w-2 rounded-full ${toneDot(action.tone)}`} />
                            </Link>
                        )) : (
                            <div className='px-4 py-6 text-sm text-ui-muted'>No customer action needed right now.</div>
                        )}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Service health</h2>
                            <p className='mt-1 text-sm text-ui-muted'>{serviceIssues.length ? `${serviceIssues.length} check${serviceIssues.length === 1 ? '' : 's'} need review.` : 'All public checks are up.'}</p>
                        </div>
                        <Radio className={`h-4 w-4 ${serviceIssues.length ? 'text-ui-warning' : 'text-ui-success'}`} />
                    </div>
                    <div className='mt-3 space-y-2'>
                        {(serviceIssues.length ? serviceIssues : slowestChecks).slice(0, 6).map((check) => (
                            <div key={`${check.service}-${check.check_name}`} className='flex items-center justify-between rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm'>
                                <div>
                                    <div className='font-medium text-ui-text'>{check.check_name}</div>
                                    <div className='text-ui-muted'>{check.service}</div>
                                </div>
                                <div className='text-right'>
                                    <div className='font-semibold text-ui-text'>{check.latency_ms}ms</div>
                                    <div className={`text-xs ${check.status === 'up' ? 'text-ui-success' : check.status === 'degraded' ? 'text-ui-warning' : 'text-ui-danger'}`}>
                                        {check.status}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!publicStatus.checks.length && (
                            <div className='rounded-lg border border-ui-border bg-ui-canvas px-3 py-3 text-sm text-ui-muted'>
                                Service checks are connecting.
                            </div>
                        )}
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function OverviewCard({ href, title, value, detail, icon, tone }: { href?: string, title: string, value: string, detail: string, icon: React.ReactNode, tone: 'ok' | 'watch' | 'bad' | 'neutral' }) {
    const content = (
        <>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-sm'>{title}</span>
                <span className={toneText(tone)}>{icon}</span>
            </div>
            <div className='mt-3 flex items-center gap-2 text-2xl font-semibold text-ui-text'>
                <span className={`h-2 w-2 rounded-full ${toneDot(tone)}`} />
                {value}
            </div>
            <p className='mt-2 text-sm leading-6 text-ui-muted'>{detail}</p>
        </>
    )

    if (href) return <Link href={href} className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm transition hover:bg-ui-raised'>{content}</Link>
    return <DashboardPanel className='border-ui-border bg-ui-panel p-4'>{content}</DashboardPanel>
}

function Stat({ title, value }: { title: string, value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-canvas px-3 py-3'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{title}</p>
            <p className='mt-2 text-xl font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function formatNumber(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

function toneText(tone: 'ok' | 'watch' | 'bad' | 'neutral') {
    if (tone === 'ok') return 'text-ui-success'
    if (tone === 'watch') return 'text-ui-warning'
    if (tone === 'bad') return 'text-ui-danger'
    return 'text-ui-primary'
}

function toneDot(tone: 'ok' | 'watch' | 'bad' | 'neutral') {
    if (tone === 'ok') return 'bg-ui-success shadow-[0_0_14px_rgba(49,196,141,0.65)]'
    if (tone === 'watch') return 'bg-ui-warning shadow-[0_0_14px_rgba(246,180,95,0.45)]'
    if (tone === 'bad') return 'bg-ui-danger shadow-[0_0_14px_rgba(255,122,89,0.45)]'
    return 'bg-ui-primary shadow-[0_0_14px_rgba(157,180,255,0.45)]'
}
