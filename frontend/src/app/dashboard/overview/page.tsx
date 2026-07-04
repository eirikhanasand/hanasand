import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Activity, AlertTriangle, BellRing, Braces, Building2, Clock3, DatabaseZap, Radio, Radar, Search, ShieldAlert } from 'lucide-react'
import { getMonitoringOverview } from '@/utils/monitoring/data'
import getStatus from '@/utils/status/getStatus'
import { toPublicServiceStatus } from '@/utils/status/publicStatus'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import parseCookie from '@/utils/cookies/parseCookie'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Monitoring Overview',
    description: 'Monitoring command surface for threat search, DWM cases, delivery routes, sources, and service health.',
}

export default async function Page() {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    const rolesCookie = cookieStore.get('roles')?.value
    const roles = parseCookie<Array<Role | string>>(rolesCookie, [])
    const roleIds = roles.map((role) => typeof role === 'string' ? role : role.id || '')
    const canManageSystem = roleIds.includes('administrator') || roleIds.includes('admin') || roleIds.includes('system_admin')

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
    const operationLanes = buildOperationLanes({
        requestsToday: overview.requestsToday,
        activeDomains: overview.activeDomains,
        criticalVulnerabilities: overview.criticalVulnerabilities,
        totalVulnerabilities: overview.totalVulnerabilities,
        imagesScanned: overview.imagesScanned,
        scanRunning: overview.scanRunning,
        serviceIssues: serviceIssues.length,
        slowestLatency: slowestChecks[0]?.latency_ms || 0,
        canManageSystem,
    })
    const attentionLanes = operationLanes.filter(lane => lane.tone === 'bad' || lane.tone === 'watch')

    return (
        <DashboardPage>
            <DashboardHeader
                title='Operations now'
                description='What is moving, what needs attention, and where to act next.'
                eyebrow='Live console'
            />

            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <OverviewCard title='Traffic moving' value={formatNumber(overview.requestsToday)} detail='requests observed in the current window' icon={<Activity className='h-4 w-4' />} tone={overview.requestsToday ? 'ok' : 'watch'} />
                <OverviewCard title='Domains watched' value={formatNumber(overview.activeDomains)} detail='active ingress and customer surfaces' icon={<Radar className='h-4 w-4' />} tone={overview.activeDomains ? 'ok' : 'watch'} />
                <OverviewCard title='Vulnerability pressure' value={formatNumber(overview.criticalVulnerabilities)} detail={`${formatNumber(overview.totalVulnerabilities)} total findings tracked`} icon={<ShieldAlert className='h-4 w-4' />} tone={overview.criticalVulnerabilities ? 'bad' : 'ok'} />
                <OverviewCard title='Scanner' value={overview.scanRunning ? 'running' : formatNumber(overview.imagesScanned)} detail={overview.scanRunning ? 'image scan is active now' : 'images in the latest vulnerability set'} icon={<Search className='h-4 w-4' />} tone={overview.scanRunning ? 'watch' : overview.imagesScanned ? 'ok' : 'neutral'} />
            </div>

            <div className='grid gap-3 xl:grid-cols-[1.35fr_0.85fr]'>
                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='flex items-center justify-between border-b border-ui-border bg-ui-panel px-4 py-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Operations board</h2>
                            <p className='mt-1 text-sm text-ui-muted'>Every operation that matters should have a visible row, current state, and next action.</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${attentionLanes.length ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning' : 'border-ui-success/35 bg-ui-success/10 text-ui-success'}`}>
                            {attentionLanes.length ? `${attentionLanes.length} needs attention` : 'operations flowing'}
                        </span>
                    </div>
                    <div className='divide-y divide-ui-border'>
                        {operationLanes.map(lane => <OperationLane key={lane.href} {...lane} />)}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Service pulse</h2>
                            <p className='mt-1 text-sm text-ui-muted'>Slow or degraded checks stay visible.</p>
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
                                Service checks are connecting. The console remains available.
                            </div>
                        )}
                    </div>
                </DashboardPanel>
            </div>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Attention stream</h2>
                        <p className='mt-1 text-sm text-ui-muted'>The page should tell you where to start.</p>
                    </div>
                    <Clock3 className='h-4 w-4 text-ui-primary' />
                </div>
                <div className='divide-y divide-ui-border'>
                    {(attentionLanes.length ? attentionLanes : operationLanes.slice(0, 4)).map(lane => (
                        <Link key={`attention-${lane.href}`} href={lane.href} className='grid gap-2 px-4 py-3 transition hover:bg-ui-panel md:grid-cols-[1fr_auto] md:items-center'>
                            <div className='min-w-0'>
                                <p className='font-semibold text-ui-text'>{lane.title}</p>
                                <p className='mt-1 text-sm text-ui-muted'>{lane.nextAction}</p>
                            </div>
                            <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tonePill(lane.tone)}`}>
                                <span className={`h-2 w-2 rounded-full ${toneDot(lane.tone)}`} />
                                {operationalStateLabel(lane.state)}
                            </span>
                        </Link>
                    ))}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function OverviewCard({ title, value, detail, icon, tone }: { title: string, value: string, detail: string, icon: React.ReactNode, tone: 'ok' | 'watch' | 'bad' | 'neutral' }) {
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-sm'>{title}</span>
                <span className={toneText(tone)}>{icon}</span>
            </div>
            <div className='mt-3 flex items-center gap-2 text-2xl font-semibold text-ui-text'>
                <span className={`h-2 w-2 rounded-full ${toneDot(tone)}`} />
                {value}
            </div>
            <p className='mt-2 text-sm leading-6 text-ui-muted'>{detail}</p>
        </DashboardPanel>
    )
}

function formatNumber(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

type OperationLaneProps = {
    href: string
    title: string
    state: string
    metric: string
    detail: string
    nextAction: string
    icon: React.ReactNode
    tone: 'ok' | 'watch' | 'bad' | 'neutral'
}

function OperationLane({ href, title, state, metric, detail, nextAction, icon, tone }: OperationLaneProps) {
    return (
        <Link href={href} className='grid gap-3 bg-ui-panel px-4 py-3 transition hover:bg-ui-raised lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-center'>
            <div className='flex min-w-0 items-center gap-3'>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${tonePill(tone)}`}>{icon}</div>
                <div className='min-w-0'>
                    <p className='truncate font-semibold text-ui-text'>{title}</p>
                    <p className='mt-0.5 truncate text-sm text-ui-muted'>{detail}</p>
                </div>
            </div>
            <div className='grid grid-cols-2 gap-2 text-xs'>
                <div className='rounded-lg border border-ui-border bg-ui-canvas px-2 py-1'>
                    <p className='text-[9px] font-semibold uppercase text-ui-muted'>state</p>
                    <p className='mt-0.5 font-semibold text-ui-text'>{state}</p>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-canvas px-2 py-1'>
                    <p className='text-[9px] font-semibold uppercase text-ui-muted'>metric</p>
                    <p className='mt-0.5 font-semibold text-ui-text'>{metric}</p>
                </div>
            </div>
            <div className='flex items-center justify-between gap-3 lg:justify-end'>
                <p className='line-clamp-1 text-xs font-medium text-ui-muted lg:max-w-56'>{nextAction}</p>
                <span className={`h-2 w-2 shrink-0 rounded-full ${toneDot(tone)}`} />
            </div>
        </Link>
    )
}

function buildOperationLanes(input: {
    requestsToday: number
    activeDomains: number
    criticalVulnerabilities: number
    totalVulnerabilities: number
    imagesScanned: number
    scanRunning: boolean
    serviceIssues: number
    slowestLatency: number
    canManageSystem: boolean
}): OperationLaneProps[] {
    const lanes: OperationLaneProps[] = [
        {
            href: '/dashboard',
            title: 'Analyst queue',
            state: 'triage',
            metric: 'alerts + cases',
            detail: 'Work visible DWM alerts, case links, and delivery decisions.',
            nextAction: 'Open the newest case that is ready for review.',
            icon: <Radar className='h-4 w-4' />,
            tone: 'ok',
        },
        {
            href: '/dashboard/dwm',
            title: 'Exposure monitoring',
            state: input.criticalVulnerabilities ? 'customer risk' : 'monitoring',
            metric: `${formatNumber(input.totalVulnerabilities)} findings`,
            detail: 'Watchlist matches, evidence, cases, and webhook delivery in one flow.',
            nextAction: input.criticalVulnerabilities ? 'Review critical exposure before delivery.' : 'Keep watchlists and delivery routes active.',
            icon: <Building2 className='h-4 w-4' />,
            tone: input.criticalVulnerabilities ? 'watch' : 'ok',
        },
        {
            href: '/dashboard/ti/control',
            title: 'Collection',
            state: 'collecting',
            metric: 'sources + tasks',
            detail: 'Source collection, scheduled work, and coverage controls.',
            nextAction: 'Review stalled or high-pressure sources first.',
            icon: <DatabaseZap className='h-4 w-4' />,
            tone: 'neutral',
        },
        {
            href: '/dashboard/ti/enrichment',
            title: 'Actor profiles',
            state: 'refreshing',
            metric: 'profiles + discoveries',
            detail: 'Actor profiles show current source checks and added facts.',
            nextAction: 'Review the actor profile currently being updated.',
            icon: <Search className='h-4 w-4' />,
            tone: 'neutral',
        },
        {
            href: '/dashboard/automations',
            title: 'Delivery routes',
            state: 'routing',
            metric: 'webhooks + alerts',
            detail: 'Customer notifications, automation destinations, and alert tests.',
            nextAction: 'Test the route before sending queued alerts.',
            icon: <BellRing className='h-4 w-4' />,
            tone: 'watch',
        },
        {
            href: '/status',
            title: 'Service pulse',
            state: input.serviceIssues ? 'degraded' : 'healthy',
            metric: input.slowestLatency ? `${input.slowestLatency}ms slowest` : 'checks',
            detail: 'Public service health and latency checks.',
            nextAction: input.serviceIssues ? 'Open degraded checks.' : 'No service action needed.',
            icon: <Radio className='h-4 w-4' />,
            tone: input.serviceIssues ? 'bad' : 'ok',
        },
        {
            href: '/developers',
            title: 'API access',
            state: 'integration',
            metric: 'keys + docs',
            detail: 'Developer access belongs in the UI because invisible integrations do not exist.',
            nextAction: 'Issue or narrow keys from the account surface.',
            icon: <Braces className='h-4 w-4' />,
            tone: 'neutral',
        },
    ]

    if (input.canManageSystem) {
        lanes.push(
            {
                href: '/dashboard/vulnerabilities',
                title: 'Vulnerability scanner',
                state: input.scanRunning ? 'scanning' : input.criticalVulnerabilities ? 'review' : 'watching',
                metric: `${formatNumber(input.imagesScanned)} images`,
                detail: 'Image findings, scan recency, and scanner job control.',
                nextAction: input.criticalVulnerabilities ? 'Open critical findings.' : input.scanRunning ? 'Watch the active scan.' : 'Confirm scanner cadence.',
                icon: <ShieldAlert className='h-4 w-4' />,
                tone: input.criticalVulnerabilities ? 'bad' : input.scanRunning ? 'watch' : 'ok',
            },
            {
                href: '/dashboard/traffic',
                title: 'Traffic map',
                state: input.requestsToday ? 'live' : 'listening',
                metric: `${formatNumber(input.requestsToday)} requests`,
                detail: 'Ingress stream, hotspots, error pressure, and access controls.',
                nextAction: input.requestsToday ? 'Open hotspots and noisy routes.' : 'Confirm the stream is connected.',
                icon: <Activity className='h-4 w-4' />,
                tone: input.requestsToday ? 'ok' : 'watch',
            },
            {
                href: '/dashboard/cron-jobs',
                title: 'Background jobs',
                state: 'managed',
                metric: 'schedules + controls',
                detail: 'Scrapers, scanners, maintenance, and worker jobs need visible controls.',
                nextAction: 'Pause, start, or inspect jobs from the cron surface.',
                icon: <Clock3 className='h-4 w-4' />,
                tone: 'neutral',
            },
            {
                href: '/dashboard/backup',
                title: 'Backup and restore',
                state: 'guarded',
                metric: 'restore path',
                detail: 'Database backup state and recovery actions.',
                nextAction: 'Check the latest backup and testable restore path.',
                icon: <AlertTriangle className='h-4 w-4' />,
                tone: 'watch',
            }
        )
    }

    return lanes
}

function tonePill(tone: 'ok' | 'watch' | 'bad' | 'neutral') {
    if (tone === 'ok') return 'border-ui-success/35 bg-ui-success/10 text-ui-success'
    if (tone === 'watch') return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
    if (tone === 'bad') return 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
    return 'border-ui-border bg-ui-raised text-ui-primary'
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

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'review') return 'reviewing'
    return value.replaceAll('_', ' ')
}
