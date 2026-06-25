import Link from 'next/link'
import { BellRing, CheckCircle2, CreditCard, Gauge, ShieldCheck, Zap } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

const plans = [
    {
        name: 'Monitor',
        price: '$49/mo',
        detail: 'Company, vendor, and domain monitoring for small teams.',
        href: '/contact?intent=subscribe-monitor',
        features: ['Dark web monitoring', 'Webhook alerts', 'Threat search', '5 load tests included'],
    },
    {
        name: 'Response',
        price: '$149/mo',
        detail: 'More watch terms, faster review, and practical alert delivery.',
        href: '/contact?intent=subscribe-response',
        features: ['Everything in Monitor', 'More watched terms', 'Priority alert review', '50 load tests included'],
    },
    {
        name: 'Operator',
        price: '$399/mo',
        detail: 'For teams that want monitoring, API access, and testing volume.',
        href: '/contact?intent=subscribe-operator',
        features: ['Everything in Response', 'API delivery', 'Actor overview support', '250 load tests included'],
    },
]

export default function SubscriptionPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Subscription'
                title='Enable product access'
                description='Manage monitoring and load-testing access from one internal page. Choose a plan, then Hanasand can activate the account and webhook limits.'
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
                        <AccessRow icon={<Gauge className='h-4 w-4' />} label='API access' value='Ready after plan enablement' />
                        <AccessRow icon={<ShieldCheck className='h-4 w-4' />} label='Billing state' value='Not active' />
                    </div>
                </DashboardPanel>

                <div className='grid gap-4 md:grid-cols-3'>
                    {plans.map((plan) => (
                        <DashboardPanel key={plan.name} className='flex min-h-full flex-col p-5'>
                            <div>
                                <h2 className='text-lg font-semibold text-[#171a21]'>{plan.name}</h2>
                                <div className='mt-3 text-3xl font-semibold text-[#171a21]'>{plan.price}</div>
                                <p className='mt-2 text-sm leading-6 text-[#596170]'>{plan.detail}</p>
                            </div>
                            <div className='mt-5 grid flex-1 content-start gap-2'>
                                {plan.features.map((feature) => (
                                    <div key={feature} className='flex items-start gap-2 text-sm text-[#344054]'>
                                        <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-[#147a3b]' />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                            <Link href={plan.href} className='mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                                Enable {plan.name}
                            </Link>
                        </DashboardPanel>
                    ))}
                </div>
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
