import Link from 'next/link'
import { BellRing, CreditCard, Gauge, ShieldCheck, Zap } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

const plans = [
    {
        name: 'Monitor',
        price: '$49/mo',
        href: '/contact?intent=subscribe-monitor',
        watchTerms: '25',
        delivery: 'webhook',
        review: 'standard',
        loadTests: '5',
    },
    {
        name: 'Response',
        price: '$149/mo',
        href: '/contact?intent=subscribe-response',
        watchTerms: '100',
        delivery: 'webhook + case',
        review: 'priority',
        loadTests: '50',
    },
    {
        name: 'Operator',
        price: '$399/mo',
        href: '/contact?intent=subscribe-operator',
        watchTerms: '500',
        delivery: 'API + webhook + case',
        review: 'priority + actor context',
        loadTests: '250',
    },
]

export default function SubscriptionPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Subscription'
                title='Account access'
                description='Workspace limits, enabled routes, and plan gates.'
            />

            <div className='grid gap-4 lg:grid-cols-[0.8fr_1.2fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Current access</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Trial workspace</p>
                        </div>
                        <CreditCard className='h-5 w-5 text-[#3056d3]' />
                    </div>
                    <div className='mt-5 grid gap-3'>
                        <AccessRow icon={<BellRing className='h-4 w-4' />} label='Dark web monitoring' value='Preview mode' />
                        <AccessRow icon={<Zap className='h-4 w-4' />} label='Load testing' value='5 free tries' />
                        <AccessRow icon={<Gauge className='h-4 w-4' />} label='API access' value='Enabled by plan' />
                        <AccessRow icon={<ShieldCheck className='h-4 w-4' />} label='Billing state' value='Not active' />
                    </div>
                </DashboardPanel>

                <DashboardPanel className='overflow-hidden p-0'>
                    <div className='border-b border-[#e8edf5] bg-[#f8fafc] px-4 py-3'>
                        <h2 className='text-base font-semibold text-[#171a21]'>Plan gates</h2>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                            <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                                <tr>
                                    <th className='px-4 py-3'>Plan</th>
                                    <th className='px-4 py-3'>Price</th>
                                    <th className='px-4 py-3'>Watch terms</th>
                                    <th className='px-4 py-3'>Delivery</th>
                                    <th className='px-4 py-3'>Review</th>
                                    <th className='px-4 py-3'>Checks</th>
                                    <th className='px-4 py-3 text-right'>Action</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-[#edf0f5] bg-white'>
                                {plans.map((plan) => (
                                    <tr key={plan.name} className='hover:bg-[#fbfcfe]'>
                                        <td className='px-4 py-4 font-semibold text-[#171a21]'>{plan.name}</td>
                                        <td className='px-4 py-4 text-[#596170]'>{plan.price}</td>
                                        <td className='px-4 py-4 font-semibold text-[#3056d3]'>{plan.watchTerms}</td>
                                        <td className='px-4 py-4 text-[#596170]'>{plan.delivery}</td>
                                        <td className='px-4 py-4 text-[#596170]'>{plan.review}</td>
                                        <td className='px-4 py-4 text-[#596170]'>{plan.loadTests}/mo</td>
                                        <td className='px-4 py-4 text-right'>
                                            <Link href={plan.href} className='inline-flex h-9 items-center justify-center rounded-lg bg-[#171a21] px-3 text-xs font-semibold text-white transition hover:bg-[#2b2f39]'>
                                                Enable
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function AccessRow({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] px-3 py-2 text-sm'>
            <div className='flex min-w-0 items-center gap-2 text-[#344054]'>
                <span className='text-[#3056d3]'>{icon}</span>
                <span className='truncate font-medium'>{label}</span>
            </div>
            <span className='shrink-0 text-xs font-semibold text-[#667085]'>{value}</span>
        </div>
    )
}
