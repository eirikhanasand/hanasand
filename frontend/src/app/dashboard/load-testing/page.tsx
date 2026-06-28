import Link from 'next/link'
import { Activity, BarChart3, Flame, Gauge, Zap } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

const tiers = [
    { name: 'Free', price: '$0', runs: '5', cadence: 'manual', retention: 'latest result', cta: 'Start check', href: '/test' },
    { name: 'Starter', price: '$19/mo', runs: '50', cadence: 'manual + scheduled', retention: '30 days', cta: 'Enable', href: '/dashboard/subscription' },
    { name: 'Team', price: '$79/mo', runs: '500', cadence: 'scheduled', retention: '90 days', cta: 'Enable', href: '/dashboard/subscription' },
    { name: 'Volume', price: '$249/mo', runs: '5,000', cadence: 'scheduled', retention: '180 days', cta: 'Contact', href: '/contact?intent=load-testing' },
]

export default function LoadTestingPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Load testing'
                title='Endpoint check queue'
                description='Permitted targets, quota, result links, and release checks.'
                actions={(
                    <Link href='/test' className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                        <Flame className='h-4 w-4' />
                        Start a check
                    </Link>
                )}
            />

            <div className='grid gap-4 md:grid-cols-3'>
                <Metric icon={<Zap className='h-4 w-4' />} label='Quota' value='5 checks' detail='free workspace allowance' />
                <Metric icon={<Gauge className='h-4 w-4' />} label='Target scope' value='owned URLs' detail='permit-only checks' />
                <Metric icon={<BarChart3 className='h-4 w-4' />} label='Evidence' value='result links' detail='latency and response state' />
            </div>

            <DashboardPanel className='overflow-hidden p-0'>
                <div className='border-b border-[#e8edf5] bg-[#f8fafc] px-4 py-3'>
                    <h2 className='text-base font-semibold text-[#171a21]'>Plan limits</h2>
                </div>
                <div className='overflow-x-auto'>
                    <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                        <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                            <tr>
                                <th className='px-4 py-3'>Plan</th>
                                <th className='px-4 py-3'>Price</th>
                                <th className='px-4 py-3'>Checks</th>
                                <th className='px-4 py-3'>Cadence</th>
                                <th className='px-4 py-3'>Retention</th>
                                <th className='px-4 py-3 text-right'>Action</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#edf0f5] bg-white'>
                            {tiers.map((tier) => (
                                <tr key={tier.name} className='hover:bg-[#fbfcfe]'>
                                    <td className='px-4 py-4 font-semibold text-[#171a21]'>{tier.name}</td>
                                    <td className='px-4 py-4 text-[#596170]'>{tier.price}</td>
                                    <td className='px-4 py-4 font-semibold text-[#3056d3]'>{tier.runs}/mo</td>
                                    <td className='px-4 py-4 text-[#596170]'>{tier.cadence}</td>
                                    <td className='px-4 py-4 text-[#596170]'>{tier.retention}</td>
                                    <td className='px-4 py-4 text-right'>
                                        <Link href={tier.href} className='inline-flex h-9 items-center justify-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                                            {tier.cta}
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DashboardPanel>
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
