import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AlertTriangle, Radio } from 'lucide-react'
import getStatus from '@/utils/status/getStatus'
import { toPublicServiceStatus } from '@/utils/status/publicStatus'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import DwmOverviewPanel from './dwmOverviewPanel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Overview',
    description: 'A focused view of monitoring, alerts, cases, and service health that matter now.',
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const token = (await cookies()).get('access_token')?.value

    if (!token) {
        redirect('/logout?path=/login%3Fpath%3D/dashboard/overview%26expired=true')
    }

    const params = searchParams ? await searchParams : {}
    const deniedPathValue = params.from
    const deniedPath = typeof deniedPathValue === 'string' && deniedPathValue.startsWith('/') ? deniedPathValue : ''
    const accessDenied = params.notAllowed === 'true'
    const status = await getStatus()
    const publicStatus = toPublicServiceStatus(status)
    const serviceIssues = publicStatus.checks.filter(check => check.status !== 'up')
    const slowestChecks = [...publicStatus.checks].sort((a, b) => (b.latency_ms || 0) - (a.latency_ms || 0)).slice(0, 5)
    const actions = [serviceIssues.length ? {
        href: '/status',
        title: 'Check service health',
        detail: `${serviceIssues.length} public check${serviceIssues.length === 1 ? '' : 's'} degraded or down.`,
        tone: 'watch' as const,
    } : null].filter(Boolean)

    return (
        <DashboardPage>
            <DashboardHeader
                title='Overview'
                description='A focused view of monitoring, alerts, cases, and service health that matter now.'
                eyebrow='Dashboard'
            />

            {accessDenied ? (
                <div role='alert'>
                    <DashboardPanel className='border-ui-warning/40 bg-ui-warning/10 p-4'>
                        <div className='flex flex-wrap items-start justify-between gap-4'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-warning'>Access boundary</p>
                                <h2 className='mt-1 text-base font-semibold text-ui-text'>That dashboard route is restricted for your current role.</h2>
                                <p className='mt-1 max-w-2xl text-sm leading-6 text-ui-muted'>
                                    {deniedPath ? `Requested route: ${deniedPath}. ` : ''}Your session is still active. Use the routes shown in the sidebar, or ask an organization administrator to confirm the required role.
                                </p>
                            </div>
                            <Link href='/organizations' className='inline-flex h-9 items-center rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                Open organization access
                            </Link>
                        </div>
                    </DashboardPanel>
                </div>
            ) : null}

            <DwmOverviewPanel organizationId={firstParam(params.organizationId) || firstParam(params.orgId)} />

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

function firstParam(value: string | string[] | undefined) {
    return (Array.isArray(value) ? value[0] : value)?.trim() || undefined
}

function toneDot(tone: 'ok' | 'watch' | 'bad' | 'neutral') {
    if (tone === 'ok') return 'bg-ui-success shadow-[0_0_14px_rgba(49,196,141,0.65)]'
    if (tone === 'watch') return 'bg-ui-warning shadow-[0_0_14px_rgba(246,180,95,0.45)]'
    if (tone === 'bad') return 'bg-ui-danger shadow-[0_0_14px_rgba(255,122,89,0.45)]'
    return 'bg-ui-primary shadow-[0_0_14px_rgba(157,180,255,0.45)]'
}
