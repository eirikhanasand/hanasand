import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Activity, ArrowRight, BellRing, Code2, Radar, Search, ShieldCheck, Webhook } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export default async function Page() {
    const Cookies = await cookies()
    const Headers = await headers()
    const name = Cookies.get('name')?.value
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const impersonatingId = Cookies.get('impersonating_id')?.value || Headers.get('x-impersonating-id') || ''
    const impersonatingName = Cookies.get('impersonating_name')?.value || Headers.get('x-impersonating-name') || ''

    if (!name || !id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const displayName = impersonatingName || impersonatingId || name
    const firstName = displayName.split(/\s+/)[0] || displayName
    const consoleUrl = `/profile/${impersonatingId || id}`

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Monitoring console'
                title={`Welcome, ${firstName}. Your threat monitoring workspace is ready.`}
                description='Search current exposure data, prepare webhook alerts, and find the product/API details customers need in the shortest path possible.'
                actions={
                    <Link href='/solutions/dwm' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#22252d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#111318]'>
                        Dark web monitoring
                        <ArrowRight className='h-4 w-4' />
                    </Link>
                }
            />

            <div className='grid gap-4 xl:grid-cols-[1.35fr_0.9fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Start with the data</h2>
                            <p className='mt-2 max-w-2xl text-sm leading-6 text-[#596170]'>
                                The product is built around company, vendor, and domain matches from actor pages and corroborating public indexes.
                            </p>
                        </div>
                        <span className='w-fit rounded-full border border-[#cfd8ea] bg-[#f8fafc] px-3 py-1 text-xs font-semibold text-[#3d4758]'>Buyer preview</span>
                    </div>
                    <div className='mt-5 grid gap-3 md:grid-cols-3'>
                        <ConsoleAction
                            href='/ti'
                            icon={<Search className='h-4 w-4' />}
                            title='Search intelligence'
                            body='Look up companies, actor names, domains, and infrastructure mentions.'
                        />
                        <ConsoleAction
                            href='/solutions/dwm#webhooks'
                            icon={<Webhook className='h-4 w-4' />}
                            title='Set up webhooks'
                            body='Preview the payload your team receives when a watched term appears.'
                        />
                        <ConsoleAction
                            href='/solutions'
                            icon={<Radar className='h-4 w-4' />}
                            title='View solutions'
                            body='See how monitoring, search, and exposure checks fit together.'
                        />
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-lg font-semibold text-[#171a21]'>What customers get</h2>
                    <div className='mt-4 grid gap-3'>
                        <ValueLine icon={<BellRing className='h-4 w-4' />} title='Fast alerts' body='Company or vendor mentions delivered to webhook endpoints with match context.' />
                        <ValueLine icon={<Activity className='h-4 w-4' />} title='Current records' body='Rows are filtered for recent, useful activity instead of padded historical bulk.' />
                        <ValueLine icon={<ShieldCheck className='h-4 w-4' />} title='Actor context' body='Claims are normalized into UI-friendly entities for review, routing, and escalation.' />
                    </div>
                </DashboardPanel>
            </div>

            <div className='grid gap-4 lg:grid-cols-3'>
                <DashboardPanel className='p-5'>
                    <p className='text-xs font-semibold uppercase text-[#3056d3]'>API</p>
                    <h2 className='mt-2 text-lg font-semibold text-[#171a21]'>Connect your workflow</h2>
                    <p className='mt-2 text-sm leading-6 text-[#596170]'>Use the API and webhook payloads to feed Slack, Discord, ticketing, SIEM, or your own dashboard.</p>
                    <Link href='/developers' className='mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3056d3] hover:text-[#1f3ea8]'>
                        Developer docs
                        <Code2 className='h-4 w-4' />
                    </Link>
                </DashboardPanel>
                <DashboardPanel className='p-5'>
                    <p className='text-xs font-semibold uppercase text-[#3056d3]'>Pricing</p>
                    <h2 className='mt-2 text-lg font-semibold text-[#171a21]'>Buy monitoring, not bulk</h2>
                    <p className='mt-2 text-sm leading-6 text-[#596170]'>Plans are framed around monitored terms, alerting, and API access so teams pay for outcomes.</p>
                    <Link href='/pricing' className='mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3056d3] hover:text-[#1f3ea8]'>
                        Review pricing
                        <ArrowRight className='h-4 w-4' />
                    </Link>
                </DashboardPanel>
                <DashboardPanel className='p-5'>
                    <p className='text-xs font-semibold uppercase text-[#3056d3]'>Account</p>
                    <h2 className='mt-2 text-lg font-semibold text-[#171a21]'>Manage access</h2>
                    <p className='mt-2 text-sm leading-6 text-[#596170]'>Update profile details, devices, certificates, and account security when your team is ready.</p>
                    <Link href={consoleUrl} className='mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3056d3] hover:text-[#1f3ea8]'>
                        Open profile
                        <ArrowRight className='h-4 w-4' />
                    </Link>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function ConsoleAction({ href, icon, title, body }: { href: string, icon: React.ReactNode, title: string, body: string }) {
    return (
        <Link href={href} className='group rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-4 transition hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'>
            <div className='flex h-9 w-9 items-center justify-center rounded-lg border border-[#dfe5ee] bg-white text-[#3056d3]'>{icon}</div>
            <h3 className='mt-4 text-sm font-semibold text-[#171a21]'>{title}</h3>
            <p className='mt-2 text-sm leading-6 text-[#596170]'>{body}</p>
            <span className='mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#3056d3]'>
                Open
                <ArrowRight className='h-3.5 w-3.5 transition group-hover:translate-x-0.5' />
            </span>
        </Link>
    )
}

function ValueLine({ icon, title, body }: { icon: React.ReactNode, title: string, body: string }) {
    return (
        <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-3'>
            <div className='mt-0.5 text-[#3056d3]'>{icon}</div>
            <div>
                <h3 className='text-sm font-semibold text-[#171a21]'>{title}</h3>
                <p className='mt-1 text-sm leading-6 text-[#596170]'>{body}</p>
            </div>
        </div>
    )
}
