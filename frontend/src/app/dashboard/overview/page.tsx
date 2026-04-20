import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Activity, Radar, ShieldAlert, Sparkles } from 'lucide-react'
import { getMonitoringOverview } from '@/utils/monitoring/data'
import getStatus from '@/utils/status/getStatus'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value

    if (!token) {
        redirect('/logout?path=/login%3Fpath%3D/dashboard/overview%26expired=true')
    }

    const [overview, status] = await Promise.all([
        getMonitoringOverview(),
        getStatus(),
    ])

    return (
        <div className='px-8 py-4 md:px-16 lg:px-32'>
            <div className='grid gap-4'>
                <div>
                    <h1 className='text-2xl font-semibold text-bright'>Overview</h1>
                    <p className='mt-2 text-sm text-bright/55'>
                        Traffic, vulnerability load, and service health in one place.
                    </p>
                </div>

                <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                    <OverviewCard title='Requests Today' value={String(overview.requestsToday)} icon={<Activity className='h-4 w-4' />} />
                    <OverviewCard title='Active Domains' value={String(overview.activeDomains)} icon={<Radar className='h-4 w-4' />} />
                    <OverviewCard title='Critical Vulnerabilities' value={String(overview.criticalVulnerabilities)} icon={<ShieldAlert className='h-4 w-4' />} />
                    <OverviewCard title='Scanned Images' value={String(overview.imagesScanned)} icon={<Sparkles className='h-4 w-4' />} />
                </div>

                <div className='grid gap-4 xl:grid-cols-[1.3fr_0.9fr]'>
                    <section className='rounded-lg border border-white/10 bg-black/25 p-5'>
                        <div className='flex items-center justify-between'>
                            <h2 className='text-lg font-semibold text-bright'>Current Focus</h2>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${overview.scanRunning ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                                {overview.scanRunning ? 'Scanning' : 'Idle'}
                            </span>
                        </div>
                        <div className='mt-4 grid gap-3 md:grid-cols-3'>
                            <ActionLink href='/dashboard/vulnerabilities' title='Vulnerabilities' body='Docker image exposure, severity mix, and package detail.' />
                            <ActionLink href='/dashboard/traffic' title='Traffic' body='Live ingress, hotspots, request flow, and recent records.' />
                            <ActionLink href='/status' title='Status' body='Synthetic checks, latency, uptime, and current service state.' />
                        </div>
                    </section>

                    <section className='rounded-lg border border-white/10 bg-black/25 p-5'>
                        <h2 className='text-lg font-semibold text-bright'>Service Health</h2>
                        <div className='mt-4 space-y-3'>
                            {status.checks.slice(0, 6).map((check) => (
                                <div key={`${check.service}-${check.check_name}`} className='flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-sm'>
                                    <div>
                                        <div className='font-medium text-bright'>{check.check_name}</div>
                                        <div className='text-bright/45'>{check.service}</div>
                                    </div>
                                    <div className='text-right'>
                                        <div className='font-semibold text-bright'>{check.latency_ms}ms</div>
                                        <div className={`text-xs ${check.status === 'up' ? 'text-emerald-300' : check.status === 'degraded' ? 'text-amber-300' : 'text-red-300'}`}>
                                            {check.status}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}

function OverviewCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
    return (
        <div className='rounded-lg border border-white/10 bg-black/25 p-5'>
            <div className='flex items-center justify-between text-bright/60'>
                <span className='text-sm'>{title}</span>
                <span>{icon}</span>
            </div>
            <div className='mt-3 text-3xl font-semibold text-bright'>{value}</div>
        </div>
    )
}

function ActionLink({ href, title, body }: { href: string, title: string, body: string }) {
    return (
        <Link href={href} className='rounded-lg border border-white/8 bg-white/3 p-4 transition hover:border-[#e25822]/40 hover:bg-[#e25822]/8'>
            <div className='font-semibold text-bright'>{title}</div>
            <div className='mt-2 text-sm text-bright/55'>{body}</div>
        </Link>
    )
}
