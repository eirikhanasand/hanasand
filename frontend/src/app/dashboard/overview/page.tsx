import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Activity, BellRing, Braces, Building2, Radar, Search, ShieldAlert, Webhook } from 'lucide-react'
import { getMonitoringOverview } from '@/utils/monitoring/data'
import getStatus from '@/utils/status/getStatus'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import parseCookie from '@/utils/cookies/parseCookie'

export const dynamic = 'force-dynamic'

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

    return (
        <DashboardPage>
            <DashboardHeader
                title='Monitoring overview'
                description='Search threats, prepare webhook alerts, and move from a company name to a usable monitoring flow quickly.'
                eyebrow='Console'
            />

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <OverviewCard title='Signals inspected' value={formatNumber(overview.requestsToday)} detail='Recent API and monitoring activity' icon={<Activity className='h-4 w-4' />} />
                <OverviewCard title='Watched domains' value={formatNumber(overview.activeDomains)} detail='Customer assets available for checks' icon={<Radar className='h-4 w-4' />} />
                <OverviewCard title='Critical CVEs' value={formatNumber(overview.criticalVulnerabilities)} detail='High-severity exposure context' icon={<ShieldAlert className='h-4 w-4' />} />
                <OverviewCard title='Source groups' value={formatNumber(overview.imagesScanned)} detail='Indexed feeds and enrichment sets' icon={<Search className='h-4 w-4' />} />
            </div>

            <div className='grid gap-4 xl:grid-cols-[1.3fr_0.9fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between'>
                        <h2 className='text-lg font-semibold text-[#171a21]'>Current focus</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${overview.scanRunning ? 'bg-[#eef3ff] text-[#3056d3]' : 'bg-[#e9f8ef] text-[#147a3b]'}`}>
                            {overview.scanRunning ? 'Monitoring active' : 'Ready'}
                        </span>
                    </div>
                    <div className='mt-4 grid gap-3 md:grid-cols-3'>
                        <ActionLink href='/ti' title='Threat search' body='Search companies, actors, vendors, domains, and claims.' icon={<Search className='h-4 w-4' />} />
                        <ActionLink href='/solutions/dwm#webhooks' title='Webhook alerts' body='Preview the alert payload and delivery format.' icon={<Webhook className='h-4 w-4' />} />
                        <ActionLink href='/dashboard/automations' title='Alert delivery' body='Prepare recurring checks and keep the handoff history in one place.' icon={<BellRing className='h-4 w-4' />} />
                        <ActionLink href='/solutions/dwm' title='Dark web monitoring' body='See what the product tracks and how a buyer uses the API.' icon={<Building2 className='h-4 w-4' />} />
                        <ActionLink href='/developers' title='API access' body='Connect monitoring data to a workflow, SIEM, CRM, or ticket queue.' icon={<Braces className='h-4 w-4' />} />
                        {canManageSystem && <ActionLink href='/dashboard/vulnerabilities' title='Vulnerabilities' body='Docker image exposure, severity mix, and package detail.' />}
                        {canManageSystem && <ActionLink href='/dashboard/traffic' title='Traffic' body='Live ingress, hotspots, request flow, and recent records.' />}
                        <ActionLink href='/status' title='Platform status' body='Service checks, latency, uptime, and current API state.' />
                        {canManageSystem && <ActionLink href='/dashboard/backup' title='Backup' body='Critical state locations, restore order, and resilience notes.' />}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-lg font-semibold text-[#171a21]'>Service health</h2>
                    <div className='mt-4 space-y-3'>
                        {status.checks.slice(0, 6).map((check) => (
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

function ActionLink({ href, title, body, icon }: { href: string, title: string, body: string, icon?: React.ReactNode }) {
    return (
        <Link href={href} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 transition hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'>
            {icon ? <div className='mb-3 text-[#3056d3]'>{icon}</div> : null}
            <div className='font-semibold text-[#171a21]'>{title}</div>
            <div className='mt-2 text-sm leading-6 text-[#596170]'>{body}</div>
        </Link>
    )
}
