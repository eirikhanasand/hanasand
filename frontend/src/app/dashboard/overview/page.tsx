import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Activity, BellRing, Braces, Building2, Radar, Search, ShieldAlert } from 'lucide-react'
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

    return (
        <DashboardPage>
            <DashboardHeader
                title='Monitoring overview'
                description='Queues, routes, source checks, delivery state, and service health.'
                eyebrow='Console'
            />

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <OverviewCard title='Activity inspected' value={formatNumber(overview.requestsToday)} detail='Recent API and monitoring activity' icon={<Activity className='h-4 w-4' />} />
                <OverviewCard title='Watched domains' value={formatNumber(overview.activeDomains)} detail='Customer assets available for checks' icon={<Radar className='h-4 w-4' />} />
                <OverviewCard title='Critical CVEs' value={formatNumber(overview.criticalVulnerabilities)} detail='High-severity exposure context' icon={<ShieldAlert className='h-4 w-4' />} />
                <OverviewCard title='Indexed sources' value={formatNumber(overview.imagesScanned)} detail='Feeds and enrichment sets available for monitoring' icon={<Search className='h-4 w-4' />} />
            </div>

            <div className='grid gap-4 xl:grid-cols-[1.3fr_0.9fr]'>
                <DashboardPanel className='overflow-hidden p-0'>
                    <div className='flex items-center justify-between border-b border-[#e8edf5] bg-[#f8fafc] px-4 py-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Command surface</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Open the queue that needs work.</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${overview.scanRunning ? 'bg-[#eef3ff] text-[#3056d3]' : 'bg-[#e9f8ef] text-[#147a3b]'}`}>
                            {overview.scanRunning ? 'monitoring active' : 'standing by'}
                        </span>
                    </div>
                    <div className='grid gap-0 divide-y divide-[#eef1f5] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3'>
                        <ActionLink href='/dashboard' title='Analyst queue' state='work cases' metric='cases' icon={<Radar className='h-4 w-4' />} />
                        <ActionLink href='/dashboard/dwm' title='DWM console' state='review alerts' metric='watchlist + evidence' icon={<Building2 className='h-4 w-4' />} />
                        <ActionLink href='/dashboard/automations' title='Delivery routes' state='check delivery' metric='webhook state' icon={<BellRing className='h-4 w-4' />} />
                        <ActionLink href='/dashboard/ti/sources' title='Source inventory' state='health + cadence' metric='source coverage' icon={<Search className='h-4 w-4' />} />
                        <ActionLink href='/dashboard/ti/runs' title='Collection runs' state='captures' metric='run state' />
                        <ActionLink href='/dashboard/ti/activity' title='TI activity' state='review stream' metric='actor changes' />
                        <ActionLink href='/dashboard/load-testing' title='Load tests' state='permitted checks' metric='result links' />
                        <ActionLink href='/developers' title='API access' state='integration' metric='docs + keys' icon={<Braces className='h-4 w-4' />} />
                        <ActionLink href='/status' title='Service health' state='latency' metric='public checks' />
                        {canManageSystem && <ActionLink href='/dashboard/vulnerabilities' title='Vulnerabilities' state='image exposure' metric='severity mix' />}
                        {canManageSystem && <ActionLink href='/dashboard/traffic' title='Traffic' state='ingress' metric='hotspots' />}
                        {canManageSystem && <ActionLink href='/dashboard/backup' title='Backup' state='restore state' metric='critical paths' />}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-lg font-semibold text-[#171a21]'>Service health</h2>
                    <div className='mt-4 space-y-3'>
                        {publicStatus.checks.slice(0, 6).map((check) => (
                            <div key={`${check.service}-${check.check_name}`} className='flex items-center justify-between rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] px-3 py-2 text-sm'>
                                <div>
                                    <div className='font-medium text-[#171a21]'>{check.check_name}</div>
                                    <div className='text-[#667085]'>{check.service}</div>
                                </div>
                                <div className='text-right'>
                                    <div className='font-semibold text-[#171a21]'>{check.latency_ms}ms</div>
                                    <div className={`text-xs ${check.status === 'up' ? 'text-[#147a3b]' : check.status === 'degraded' ? 'text-amber-700' : 'text-red-700'}`}>
                                        {check.status}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!publicStatus.checks.length && (
                            <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] px-3 py-3 text-sm text-[#596170]'>
                                Public monitor checks are preparing. The console remains available.
                            </div>
                        )}
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function OverviewCard({ title, value, detail, icon }: { title: string, value: string, detail: string, icon: React.ReactNode }) {
    return (
        <DashboardPanel className='p-5'>
            <div className='flex items-center justify-between text-[#596170]'>
                <span className='text-sm'>{title}</span>
                <span>{icon}</span>
            </div>
            <div className='mt-3 text-3xl font-semibold text-[#171a21]'>{value}</div>
            <p className='mt-2 text-sm leading-6 text-[#667085]'>{detail}</p>
        </DashboardPanel>
    )
}

function formatNumber(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

function ActionLink({ href, title, state, metric, icon }: { href: string, title: string, state: string, metric: string, icon?: React.ReactNode }) {
    return (
        <Link href={href} className='grid min-h-32 content-between bg-white p-4 transition hover:bg-[#f4f7ff]'>
            <div className='flex items-center justify-between gap-3'>
                <div className='font-semibold text-[#171a21]'>{title}</div>
                {icon ? <div className='text-[#3056d3]'>{icon}</div> : null}
            </div>
            <div className='mt-4 grid grid-cols-2 gap-2 text-xs'>
                <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] px-2 py-1'>
                    <p className='text-[9px] font-semibold uppercase text-[#8c95a5]'>state</p>
                    <p className='mt-0.5 font-semibold text-[#344054]'>{state}</p>
                </div>
                <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] px-2 py-1'>
                    <p className='text-[9px] font-semibold uppercase text-[#8c95a5]'>metric</p>
                    <p className='mt-0.5 font-semibold text-[#344054]'>{metric}</p>
                </div>
            </div>
        </Link>
    )
}
