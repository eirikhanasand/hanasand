import Link from 'next/link'
import { BellRing, CheckCircle2, CreditCard, FileCheck2, Gauge, Radio, ShieldCheck } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { ReactNode } from 'react'
import { commercialAccessPlans } from '@/utils/commercialAccess'

export const dynamic = 'force-dynamic'

const gates = [
    { label: 'Monitoring delivery', value: 'Open', detail: 'Review webhook and case delivery.', href: '/dashboard/automations', icon: <BellRing className='h-4 w-4' />, tone: 'ok' as const },
    { label: 'API keys', value: 'Scoped', detail: 'Create owner-linked tokens.', href: '/dashboard/system/rate-limits', icon: <Gauge className='h-4 w-4' />, tone: 'ok' as const },
    { label: 'Commercial scope', value: 'Sales managed', detail: 'Record access and limits in an order form.', href: '/contact?intent=subscription', icon: <CreditCard className='h-4 w-4' />, tone: 'trial' as const },
]

const utilityGates = [
    { label: 'Service checks', value: 'Utility', detail: 'Permitted endpoint checks for URLs you control.', href: '/dashboard/load-testing', icon: <Gauge className='h-4 w-4' />, tone: 'trial' as const },
]

const enterpriseReviewItems = [
    { label: 'Security review', value: 'Trust artifacts', href: '/trust' },
    { label: 'Commercial path', value: 'Talk to sales', href: '/contact?intent=enterprise-procurement' },
    { label: 'Admin controls', value: 'Organizations', href: '/organizations' },
    { label: 'Delivery history', value: 'Webhook history', href: '/dashboard/automations' },
]

export default function SubscriptionPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Commercial access'
                title='Evaluate first, then provision monitored coverage'
                description='Console evaluation is self-serve. Monitoring, delivery, API budgets, retention, support, and price are confirmed through managed setup and a written order form.'
            />

            <div className='grid gap-3'>
                <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
                    <div className='grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center'>
                        <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='inline-flex items-center gap-1.5 rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-primary'>
                                    <Radio className='h-3.5 w-3.5' />
                                    Self-serve evaluation
                                </span>
                                <span className='rounded-full border border-ui-warning bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-warning'>Not a paid subscription</span>
                            </div>
                            <h2 className='mt-2 text-lg font-semibold text-ui-text'>Evaluation access</h2>
                            <p className='mt-1 max-w-3xl text-sm leading-5 text-ui-muted'>A console account lets you evaluate product surfaces. It does not imply a paid plan or fixed monitoring quota; production coverage is provisioned after scope is agreed.</p>
                        </div>
                        <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-130'>
                            <AccessMetric label='Console' value='Evaluation' />
                            <AccessMetric label='Monitoring' value='Setup' />
                            <AccessMetric label='Limits' value='Order form' />
                            <AccessMetric label='Billing' value='Sales managed' />
                        </div>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='border-ui-primary/35 bg-ui-panel p-4' data-subscription-primary-flow>
                    <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                        <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted'>
                                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1'>Recommended next</span>
                                <span className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-ui-primary'>Monitoring</span>
                            </div>
                            <h2 className='mt-3 text-lg font-semibold text-ui-text'>Scope production monitoring</h2>
                            <p className='mt-1 max-w-3xl text-sm leading-6 text-ui-muted'>Confirm watched entities, source coverage, webhook destinations, API budgets, retention, support, and price before activation.</p>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <Link href='/contact?plan=monitoring' className='inline-flex h-10 items-center justify-center rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90' data-subscription-primary-action>
                                Scope monitoring
                            </Link>
                            <Link href='/trust' className='inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                <ShieldCheck className='h-4 w-4' />
                                Trust review
                            </Link>
                        </div>
                    </div>
                </DashboardPanel>

                <section className='grid gap-3 xl:grid-cols-3'>
                    {commercialAccessPlans.map(plan => <PlanCard key={plan.name} plan={plan} />)}
                </section>

                <div className='grid gap-3 xl:grid-cols-[1.1fr_0.9fr]'>
                    <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                        <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-3 py-2.5'>
                            <div>
                                <h2 className='text-sm font-semibold text-ui-text'>Plan comparison</h2>
                                <p className='mt-0.5 text-xs text-ui-muted'>The access boundary for each commercial path.</p>
                            </div>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='min-w-full divide-y divide-ui-border text-sm'>
                                <thead className='bg-ui-raised text-left text-[11px] font-semibold uppercase text-ui-muted'>
                                    <tr>
                                        <th className='px-3 py-2'>Plan</th>
                                        <th className='px-3 py-2'>Access</th>
                                        <th className='px-3 py-2'>Delivery</th>
                                        <th className='px-3 py-2'>Review</th>
                                        <th className='px-3 py-2 text-right'>Action</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-ui-border bg-ui-panel'>
                                    {commercialAccessPlans.map(plan => (
                                        <tr key={plan.name} className='hover:bg-ui-raised'>
                                            <td className='px-3 py-2 font-semibold text-ui-text'>
                                                {plan.name}
                                                <span className='ml-2 text-xs font-medium text-ui-muted'>{plan.priceLabel}</span>
                                            </td>
                                            <td className='px-3 py-2 text-ui-muted'>{plan.access}</td>
                                            <td className='px-3 py-2 text-ui-muted'>{plan.delivery}</td>
                                            <td className='px-3 py-2 text-ui-muted'>{plan.review}</td>
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
                            <p className='mt-0.5 text-xs text-ui-muted'>Jump to the live monitoring surface behind each capability.</p>
                        </div>
                        <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-1'>
                            {gates.map(gate => <OperationGate key={gate.label} {...gate} />)}
                        </div>
                        <details className='mt-3 rounded-md border border-ui-border bg-ui-raised' data-subscription-utility-entitlements>
                            <summary className='flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold uppercase text-ui-muted [&::-webkit-details-marker]:hidden'>
                                Utility tools
                                <span className='text-[11px] normal-case text-ui-muted'>Separate from monitoring plans</span>
                            </summary>
                            <div className='grid gap-2 border-t border-ui-border p-2'>
                                {utilityGates.map(gate => <OperationGate key={gate.label} {...gate} />)}
                            </div>
                        </details>
                    </DashboardPanel>
                </div>

                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <details data-subscription-enterprise-review>
                        <summary className='flex cursor-pointer list-none flex-col gap-1 border-b border-ui-border bg-ui-raised px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                            <span className='inline-flex items-center gap-2'>
                                <FileCheck2 className='h-4 w-4 text-ui-primary' />
                                Enterprise review
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

function PlanCard({ plan }: { plan: typeof commercialAccessPlans[number] }) {
    const highlighted = plan.id === 'monitoring'
    return (
        <article className={`relative overflow-hidden rounded-md border bg-ui-panel p-4 shadow-sm ${highlighted ? 'border-ui-primary ring-1 ring-ui-primary/30' : 'border-ui-border'}`}>
            {highlighted ? <span className='absolute right-3 top-3 rounded-full border border-ui-warning bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-warning'>Operational fit</span> : null}
            <div className='pr-24'>
                <h2 className='text-lg font-semibold text-ui-text'>{plan.name}</h2>
                <p className='mt-1 min-h-10 text-sm leading-5 text-ui-muted'>{plan.bestFor}</p>
            </div>
            <div className='mt-3 grid gap-1'>
                <span className='text-2xl font-semibold tracking-normal text-ui-text'>{plan.priceLabel}</span>
                <span className='text-sm font-medium text-ui-muted'>{plan.access}</span>
            </div>
            <Link href={plan.href} className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-semibold transition ${highlighted ? 'bg-ui-primary text-ui-canvas hover:opacity-90' : 'border border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary'}`}>
                {plan.cta}
            </Link>
            <div className='mt-4 grid gap-2 text-sm'>
                <PlanLine label='Access' value={plan.access} />
                <PlanLine label='Delivery' value={plan.delivery} />
                <PlanLine label='Review' value={plan.review} />
            </div>
            <div className='mt-4 border-t border-ui-border pt-3'>
                <p className='text-[11px] font-semibold uppercase text-ui-muted'>Included</p>
                <ul className='mt-2 grid gap-1.5 text-sm text-ui-text'>
                    {plan.features.map(item => (
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
