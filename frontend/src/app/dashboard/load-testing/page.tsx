import Link from 'next/link'
import { Activity, BarChart3, CheckCircle2, Flame, Gauge, Zap } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

const tiers = [
    { name: 'Free', price: '$0', detail: '5 permitted endpoint checks for evaluation.', runs: '5 tries', cta: 'Start free checks', href: '/test' },
    { name: 'Starter', price: '$19/mo', detail: 'Simple recurring checks for small websites and APIs.', runs: '50 checks / month', cta: 'Enable Starter', href: '/dashboard/subscription' },
    { name: 'Team', price: '$79/mo', detail: 'More checks, result history, and monitoring workflows.', runs: '500 checks / month', cta: 'Enable Team', href: '/dashboard/subscription' },
    { name: 'Volume', price: '$249/mo', detail: 'Higher volume testing for launches and customer-facing APIs.', runs: '5,000 checks / month', cta: 'Talk to sales', href: '/contact?intent=load-testing' },
]

export default function LoadTestingPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Load testing'
                title='Permitted endpoint checks and launch readiness'
                description='Run lightweight checks against URLs you control, keep result links, and upgrade when the free five tries are not enough.'
                actions={(
                    <Link href='/test' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                        <Flame className='h-4 w-4' />
                        Start a check
                    </Link>
                )}
            />

            <div className='grid gap-4 md:grid-cols-3'>
                <Metric icon={<Zap className='h-4 w-4' />} label='Free allowance' value='5 tries' detail='For logged-out or unsubscribed users.' />
                <Metric icon={<Gauge className='h-4 w-4' />} label='Use case' value='Launch checks' detail='Measure availability and response behavior before sharing.' />
                <Metric icon={<BarChart3 className='h-4 w-4' />} label='Output' value='Result links' detail='Shareable reports for customers, teammates, and release notes.' />
            </div>

            <div className='grid gap-4 lg:grid-cols-4'>
                {tiers.map((tier) => (
                    <DashboardPanel key={tier.name} className='flex min-h-full flex-col p-5'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>{tier.name}</h2>
                            <div className='mt-3 text-3xl font-semibold text-[#171a21]'>{tier.price}</div>
                            <p className='mt-2 text-sm leading-6 text-[#596170]'>{tier.detail}</p>
                        </div>
                        <div className='mt-5 flex flex-1 items-start gap-2 text-sm text-[#344054]'>
                            <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-[#147a3b]' />
                            <span>{tier.runs}</span>
                        </div>
                        <Link href={tier.href} className='mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                            {tier.cta}
                        </Link>
                    </DashboardPanel>
                ))}
            </div>
        </DashboardPage>
    )
}

function Metric({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return (
        <DashboardPanel className='p-5'>
            <div className='flex items-center justify-between text-[#596170]'>
                <span className='text-sm'>{label}</span>
                <span className='text-[#3056d3]'>{icon}</span>
            </div>
            <div className='mt-3 flex items-center gap-2 text-2xl font-semibold text-[#171a21]'>
                <Activity className='h-5 w-5 text-[#147a3b]' />
                {value}
            </div>
            <p className='mt-2 text-sm leading-6 text-[#667085]'>{detail}</p>
        </DashboardPanel>
    )
}
