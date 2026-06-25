import Link from 'next/link'
import { BellRing, Code2, ExternalLink, Radar, ShieldCheck, Webhook } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

const samplePayload = {
    eventType: 'darkweb.monitoring.match',
    severity: 'review',
    actor: 'Akira',
    company: 'Acme Payments',
    matchedTerm: 'acme.com',
    claimSummary: 'Actor page lists a new victim claim and mentions financial records, contracts, and employee data.',
    claimedAt: '2026-06-23T07:58:00.000Z',
    confidence: 0.84,
    recommendedAction: 'Confirm the company match, notify vendor-risk or incident response, and watch for claim updates.',
}

const previewRows = [
    { company: 'Acme Payments', actor: 'Akira', term: 'acme.com', state: 'Review', age: '18 min' },
    { company: 'Northwind Supplier', actor: 'Cl0p', term: 'northwind.example', state: 'Watching', age: '2 hr' },
    { company: 'Contoso Health', actor: 'LockBit', term: 'contosohealth.com', state: 'Queued', age: 'Today' },
]

export default function DashboardDwmPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Dark web monitoring'
                title='Company and vendor exposure alerts'
                description='Preview recent monitored mentions, configure watch terms, and subscribe a webhook without leaving the console.'
                actions={(
                    <Link href='/dashboard/subscription' className='inline-flex h-10 items-center rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                        Enable monitoring
                    </Link>
                )}
            />

            <div className='grid gap-4 xl:grid-cols-[1.1fr_0.9fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Monitoring preview</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Example rows shaped for alert routing and vendor-risk review.</p>
                        </div>
                        <Radar className='h-5 w-5 text-[#3056d3]' />
                    </div>
                    <div className='mt-5 grid gap-2'>
                        {previewRows.map((row) => (
                            <div key={`${row.company}-${row.actor}`} className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 md:grid-cols-[1fr_auto] md:items-center'>
                                <div className='min-w-0'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <h3 className='font-semibold text-[#171a21]'>{row.company}</h3>
                                        <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'>{row.actor}</span>
                                    </div>
                                    <p className='mt-1 text-sm text-[#596170]'>Matched term: <span className='font-mono'>{row.term}</span></p>
                                </div>
                                <div className='flex items-center gap-2 text-xs'>
                                    <span className='rounded-full bg-[#f3fbf6] px-2 py-1 font-semibold text-[#147a3b]'>{row.state}</span>
                                    <span className='text-[#667085]'>{row.age}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Webhook subscription</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Use this payload shape for Slack, Jira, SOAR, CRM, or a customer portal.</p>
                        </div>
                        <Webhook className='h-5 w-5 text-[#3056d3]' />
                    </div>
                    <div className='mt-4 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-3'>
                        <pre className='max-h-80 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-5 text-[#344054]'>{JSON.stringify(samplePayload, null, 2)}</pre>
                    </div>
                    <div className='mt-4 flex flex-wrap gap-2'>
                        <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                            <BellRing className='h-4 w-4' />
                            Subscribe webhook
                        </Link>
                        <Link href='/developers' className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                            <Code2 className='h-4 w-4' />
                            API docs
                        </Link>
                    </div>
                </DashboardPanel>
            </div>

            <div className='grid gap-4 lg:grid-cols-3'>
                <ValueCard icon={<ShieldCheck className='h-4 w-4' />} title='What it does' body='Matches watched companies, domains, products, vendors, and aliases against monitored actor-page activity.' />
                <ValueCard icon={<BellRing className='h-4 w-4' />} title='Why it matters' body='Teams pay for fast company-specific mentions and useful routing context, not another bulk breach list.' />
                <ValueCard icon={<ExternalLink className='h-4 w-4' />} title='How to use it' body='Send alert payloads to a ticket queue, vendor-risk workflow, executive brief, or incident-response channel.' />
            </div>
        </DashboardPage>
    )
}

function ValueCard({ icon, title, body }: { icon: ReactNode, title: string, body: string }) {
    return (
        <DashboardPanel className='p-5'>
            <div className='text-[#3056d3]'>{icon}</div>
            <h2 className='mt-3 text-base font-semibold text-[#171a21]'>{title}</h2>
            <p className='mt-2 text-sm leading-6 text-[#596170]'>{body}</p>
        </DashboardPanel>
    )
}
