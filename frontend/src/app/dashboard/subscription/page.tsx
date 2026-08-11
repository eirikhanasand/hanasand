import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import { commercialAccessPlans } from '@/utils/commercialAccess'

export const dynamic = 'force-dynamic'

export default function SubscriptionPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Plans'
                title='Choose what you need'
                description='Simple monthly plans with clear quotas. Start immediately and change plans whenever you need.'
            />

            <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4' aria-label='Available plans'>
                {commercialAccessPlans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
            </section>

            <p className='text-center text-xs text-ui-muted'>Secure checkout is handled by Stripe. Cancel anytime from your billing portal.</p>
        </DashboardPage>
    )
}

function PlanCard({ plan }: { plan: typeof commercialAccessPlans[number] }) {
    const highlighted = plan.id === 'monitoring'
    return (
        <article className={`flex flex-col rounded-md border bg-ui-panel p-4 ${highlighted ? 'border-ui-primary ring-1 ring-ui-primary/30' : 'border-ui-border'}`}>
            <div className='flex-1'>
                {highlighted ? <span className='rounded-full border border-ui-primary/40 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary'>Most popular</span> : null}
                <h2 className='mt-3 text-lg font-semibold text-ui-text'>{plan.name}</h2>
                <p className='mt-2 min-h-12 text-sm leading-5 text-ui-muted'>{plan.summary}</p>
                <p className='mt-4 text-2xl font-semibold text-ui-text'><span className='font-mono tabular-nums tracking-tight'>{plan.priceNok}</span> kr / måned</p>
                <p className='mt-1 text-sm font-semibold text-ui-primary'>{plan.quota}</p>
                <Link href={`/api/billing/checkout?plan=${plan.id}`} className={`mt-4 inline-flex h-10 w-full items-center justify-center rounded-md px-3 text-sm font-semibold transition ${highlighted ? 'bg-ui-primary text-ui-canvas hover:opacity-90' : 'border border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary'}`}>
                    Buy now
                </Link>
                <div className='mt-4 border-t border-ui-border pt-3'>
                    <p className='text-sm font-semibold text-ui-text'>What's included</p>
                    <ul className='mt-3 grid gap-2 text-sm text-ui-muted'>
                        {plan.features.map(feature => <li key={feature} className='flex items-start gap-2'><CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-ui-success' /><span>{feature}</span></li>)}
                    </ul>
                </div>
            </div>
        </article>
    )
}
