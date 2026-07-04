import Link from 'next/link'
import { BellRing, CheckCircle2, CreditCard, FileCheck2, Gauge, Radio, ShieldCheck, Zap } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

const plans = [
    {
        name: 'Monitor',
        price: '$49',
        href: '/contact?intent=subscribe-monitor',
        bestFor: 'Small teams watching a focused list of companies or domains.',
        watchTerms: '25 watch terms',
        delivery: 'Webhook alerts',
        review: 'Standard analyst review',
        checks: '5 load checks / month',
        includes: ['Dark web monitoring', 'Alert delivery', 'Threat search access'],
    },
    {
        name: 'Response',
        price: '$149',
        href: '/contact?intent=subscribe-response',
        bestFor: 'Security teams that need cases, priority review, and more coverage.',
        watchTerms: '100 watch terms',
        delivery: 'Webhook + case routing',
        review: 'Priority analyst review',
        checks: '50 load checks / month',
        includes: ['Everything in Monitor', 'Case workflows', 'Webhook delivery history'],
        highlighted: true,
    },
    {
        name: 'Operator',
        price: '$399',
        href: '/contact?intent=subscribe-operator',
        bestFor: 'Operational teams running broad monitoring and API-driven workflows.',
        watchTerms: '500 watch terms',
        delivery: 'API + webhook + cases',
        review: 'Priority review with actor context',
        checks: '250 load checks / month',
        includes: ['Everything in Response', 'Scoped API tokens', 'Actor context enrichment'],
    },
]

const gates = [
    { label: 'Monitoring delivery', value: 'Live', detail: 'Manage webhook and case delivery.', href: '/dashboard/automations', icon: <BellRing className='h-4 w-4' />, tone: 'ok' as const },
    { label: 'Load checks', value: '5 left', detail: 'Run checks from the load testing page.', href: '/dashboard/load-testing', icon: <Zap className='h-4 w-4' />, tone: 'trial' as const },
    { label: 'API keys', value: 'Scoped', detail: 'Create owner-linked tokens.', href: '/dashboard/system/rate-limits', icon: <Gauge className='h-4 w-4' />, tone: 'ok' as const },
    { label: 'Billing', value: 'Trial', detail: 'Upgrade or talk to sales.', href: '/contact?intent=subscription', icon: <CreditCard className='h-4 w-4' />, tone: 'trial' as const },
]

const enterpriseReviewItems = [
    { label: 'Security review', value: 'Trust artifacts', href: '/trust' },
    { label: 'Commercial path', value: 'Talk to sales', href: '/contact?intent=enterprise-procurement' },
    { label: 'Admin controls', value: 'Organizations', href: '/organizations' },
    { label: 'Delivery proof', value: 'Webhook history', href: '/dashboard/automations' },
]

export default function SubscriptionPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Subscription'
                title='Enable product access'
                description='Review current workspace capabilities, choose the next coverage tier, and open the enterprise review path when procurement needs evidence.'
            />

            <div className='grid gap-3'>
                <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
                    <div className='grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center'>
                        <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='inline-flex items-center gap-1.5 rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-primary'>
                                    <Radio className='h-3.5 w-3.5' />
                                    Trial workspace
                                </span>
                                <span className='rounded-full border border-ui-success bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-success'>Monitoring routes enabled</span>
                            </div>
                            <h2 className='mt-2 text-lg font-semibold text-ui-text'>Current access</h2>
                            <p className='mt-1 max-w-3xl text-sm leading-5 text-ui-muted'>You can test monitoring, delivery, API keys, and load checks now. Upgrade when you need more watch terms, review priority, or API-driven delivery.</p>
                        </div>
                        <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]'>
                            <AccessMetric label='Watch terms' value='Trial' />
                            <AccessMetric label='Delivery' value='Live' />
                            <AccessMetric label='API' value='Scoped' />
                            <AccessMetric label='Checks' value='5' />
                        </div>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='border-ui-primary/35 bg-ui-panel p-4' data-subscription-primary-flow>
                    <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                        <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted'>
                                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>Recommended next</span>
                                <span className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-ui-primary'>Response</span>
                            </div>
                            <h2 className='mt-3 text-lg font-semibold text-ui-text'>Move from trial checks to routed response</h2>
                            <p className='mt-1 max-w-3xl text-sm leading-6 text-ui-muted'>Response adds case routing, delivery history, and priority review before expanding into broad API-driven operations. Use Operator when scoped tokens and actor enrichment are part of the workflow.</p>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <Link href='/contact?intent=subscribe-response' className='inline-flex h-10 items-center justify-center rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90' data-subscription-primary-action>
                                Choose Response
                            </Link>
                            <Link href='/trust' className='inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                <ShieldCheck className='h-4 w-4' />
                                Trust review
                            </Link>
                        </div>
                    </div>
                </DashboardPanel>

                <section className='grid gap-3 xl:grid-cols-3'>
                    {plans.map(plan => <PlanCard key={plan.name} plan={plan} />)}
                </section>

                <div className='grid gap-3 xl:grid-cols-[1.1fr_0.9fr]'>
                    <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                        <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-3 py-2.5'>
                            <div>
                                <h2 className='text-sm font-semibold text-ui-text'>Plan comparison</h2>
                                <p className='mt-0.5 text-xs text-ui-muted'>The main limits that change when you upgrade.</p>
                            </div>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='min-w-full divide-y divide-ui-border text-sm'>
                                <thead className='bg-ui-raised text-left text-[11px] font-semibold uppercase text-ui-muted'>
                                    <tr>
                                        <th className='px-3 py-2'>Plan</th>
                                        <th className='px-3 py-2'>Watchlist</th>
                                        <th className='px-3 py-2'>Delivery</th>
                                        <th className='px-3 py-2'>Review</th>
                                        <th className='px-3 py-2'>Checks</th>
                                        <th className='px-3 py-2 text-right'>Action</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-ui-border bg-ui-panel'>
                                    {plans.map(plan => (
                                        <tr key={plan.name} className='hover:bg-ui-raised'>
                                            <td className='px-3 py-2 font-semibold text-ui-text'>
                                                {plan.name}
                                                <span className='ml-2 text-xs font-medium text-ui-muted'>{plan.price}/mo</span>
                                            </td>
                                            <td className='px-3 py-2 text-ui-muted'>{plan.watchTerms}</td>
                                            <td className='px-3 py-2 text-ui-muted'>{plan.delivery}</td>
                                            <td className='px-3 py-2 text-ui-muted'>{plan.review}</td>
                                            <td className='px-3 py-2 text-ui-muted'>{plan.checks}</td>
                                            <td className='px-3 py-2 text-right'>
                                                <Link href={plan.href} className='inline-flex h-8 items-center justify-center rounded-md border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>
                                                    Choose
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </DashboardPanel>

                    <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
                        <div className='mb-2'>
                            <h2 className='text-sm font-semibold text-ui-text'>Workspace entitlements</h2>
                            <p className='mt-0.5 text-xs text-ui-muted'>Jump to the live surface behind each capability.</p>
                        </div>
                        <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-1'>
                            {gates.map(gate => <OperationGate key={gate.label} {...gate} />)}
                        </div>
                    </DashboardPanel>
                </div>

                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <details data-subscription-enterprise-review>
                        <summary className='flex cursor-pointer list-none flex-col gap-1 border-b border-ui-border bg-ui-raised px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                            <span className='inline-flex items-center gap-2'>
                                <FileCheck2 className='h-4 w-4 text-ui-primary' />
                                Enterprise review packet
                            </span>
                            <span className='text-xs font-medium text-ui-muted'>Security, procurement, admin, and delivery evidence</span>
                        </summary>
                        <div className='grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4' data-subscription-enterprise-review-items>
                            {enterpriseReviewItems.map(item => (
                                <Link key={item.label} href={item.href} className='rounded-md border border-ui-border bg-ui-raised p-3 transition hover:border-ui-primary hover:bg-ui-panel'>
                                    <span className='block text-xs font-semibold uppercase text-ui-muted'>{item.label}</span>
                                    <span className='mt-1 block text-sm font-semibold text-ui-text'>{item.value}</span>
                                </Link>
                            ))}
                        </div>
                    </details>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function PlanCard({ plan }: { plan: typeof plans[number] }) {
    return (
        <article className={`relative overflow-hidden rounded-md border bg-ui-panel p-4 shadow-sm ${plan.highlighted ? 'border-ui-primary ring-1 ring-ui-primary/30' : 'border-ui-border'}`}>
            {plan.highlighted ? <span className='absolute right-3 top-3 rounded-full border border-ui-warning bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-warning'>Most useful</span> : null}
            <div className='pr-24'>
                <h2 className='text-lg font-semibold text-ui-text'>{plan.name}</h2>
                <p className='mt-1 min-h-10 text-sm leading-5 text-ui-muted'>{plan.bestFor}</p>
            </div>
            <div className='mt-3 flex items-end gap-1'>
                <span className='text-3xl font-semibold tracking-normal text-ui-text'>{plan.price}</span>
                <span className='pb-1 text-sm font-medium text-ui-muted'>/ month</span>
            </div>
            <Link href={plan.href} className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-semibold transition ${plan.highlighted ? 'bg-ui-primary text-ui-canvas hover:opacity-90' : 'border border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary'}`}>
                Choose {plan.name}
            </Link>
            <div className='mt-4 grid gap-2 text-sm'>
                <PlanLine label='Watchlist' value={plan.watchTerms} />
                <PlanLine label='Delivery' value={plan.delivery} />
                <PlanLine label='Review' value={plan.review} />
                <PlanLine label='Checks' value={plan.checks} />
            </div>
            <div className='mt-4 border-t border-ui-border pt-3'>
                <p className='text-[11px] font-semibold uppercase text-ui-muted'>Included</p>
                <ul className='mt-2 grid gap-1.5 text-sm text-ui-text'>
                    {plan.includes.map(item => (
                        <li key={item} className='flex items-center gap-2'>
                            <CheckCircle2 className='h-4 w-4 shrink-0 text-ui-success' />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </article>
    )
}

function AccessMetric({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-raised px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function PlanLine({ label, value }: { label: string, value: string }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2'>
            <span className='text-ui-muted'>{label}</span>
            <span className='text-right font-semibold text-ui-text'>{value}</span>
        </div>
    )
}

function OperationGate({ icon, label, value, detail, href, tone }: { icon: ReactNode, label: string, value: string, detail: string, href: string, tone: 'ok' | 'trial' }) {
    const dot = tone === 'ok'
        ? 'bg-ui-success shadow-[0_0_14px_rgba(125,224,162,0.45)]'
        : 'bg-ui-primary shadow-[0_0_14px_rgba(143,178,255,0.35)]'

    return (
        <Link href={href} className='group flex items-center justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2 transition hover:border-ui-primary'>
            <span className='flex min-w-0 items-center gap-2'>
                <span className='text-ui-primary'>{icon}</span>
                <span className='min-w-0'>
                    <span className='block truncate text-sm font-semibold text-ui-text'>{label}</span>
                    <span className='block truncate text-xs text-ui-muted'>{detail}</span>
                </span>
            </span>
            <span className='flex shrink-0 items-center gap-2 text-xs font-semibold text-ui-text'>
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {value}
            </span>
        </Link>
    )
}
