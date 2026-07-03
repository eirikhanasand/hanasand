import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, ClipboardCheck, FileText, LockKeyhole, ServerCog, ShieldCheck, Siren, Webhook } from 'lucide-react'
import { buildRouteMetadata } from '../seo'
import { trustArtifacts } from './trustArtifacts'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Trust Center',
    description: 'Security, procurement, data handling, subprocessors, SLA, and enterprise review information for Hanasand.',
    path: '/trust',
    keywords: ['hanasand trust center', 'hanasand security', 'hanasand dpa', 'hanasand subprocessors', 'hanasand sla'],
})

const assuranceCards = [
    {
        title: 'Security overview',
        status: 'Published',
        detail: 'How Hanasand handles watchlists, alert records, webhooks, API access, audit events, and operational logs.',
        icon: ShieldCheck,
        href: '/trust/security-overview',
    },
    {
        title: 'DPA and contract pack',
        status: 'Available on request',
        detail: 'Data processing terms, confidentiality language, order-form notes, and security questionnaire responses for procurement.',
        icon: FileText,
        href: '/trust/dpa-and-data',
    },
    {
        title: 'Subprocessor register',
        status: 'Published by category',
        detail: 'Infrastructure, database, mail/notification, payment, and customer-selected integration categories are listed below.',
        icon: ServerCog,
        href: '/trust/subprocessors',
    },
    {
        title: 'SOC 2 / ISO 27001',
        status: 'Not certified yet',
        detail: 'No badge is claimed today. The controls below are the current operating model and the gap is visible by design.',
        icon: BadgeCheck,
        href: '/trust/security-overview',
    },
]

const controlRows = [
    ['Tenant and role model', 'Available now', 'Organizations, roles, admin-managed members, shared watchlists, and alert scope are represented in the customer console.'],
    ['Audit trails', 'Available now', 'Admin/support actions, alert workflow events, delivery attempts, and operational status are tracked in product surfaces where the backing API is enabled.'],
    ['Webhook safety', 'Available now', 'Webhook destinations use scoped endpoints, delivery status, retry state, and customer-owned downstream routing. Signing-key review is part of enterprise setup.'],
    ['Data handling', 'Available now', 'Monitoring is metadata-first: watch terms, source references, alert fields, hashes, timestamps, notes, and review states. Raw leak material is not the normal buyer workflow.'],
    ['DPA / MSA / order form', 'Available on request', 'Use the procurement request path and include organization name, jurisdiction, vendor portal, and deadline.'],
    ['SLA and support terms', 'Available on request', 'Pilot terms are lightweight; enterprise terms can include response targets, notification path, and escalation contacts.'],
    ['SSO / SAML / OIDC / SCIM', 'Roadmap / scoped deal', 'Password accounts exist today. Enterprise identity requirements should be raised before purchase so implementation scope is explicit.'],
    ['SOC 2 / ISO 27001', 'Not certified', 'Security review can inspect current controls, but no independent SOC 2 or ISO certificate is claimed.'],
]

const buyerReviewRows = [
    ['Live product check', 'Search a company or actor, inspect the current alert list, and review source context before any sales call.', '/ti/apt29'],
    ['Pilot design', 'Define watched companies, suppliers, domains, delivery route, alert reviewer, and success criteria for the first month.', '/pricing#pilot-path'],
    ['Procurement packet', 'Review DPA notes, subprocessor categories, SLA expectations, security questionnaire inputs, and onboarding timeline before requesting a signed packet.', '/trust/dpa-and-data'],
    ['Current boundary', 'Use Hanasand for direct company exposure alerts. Choose a larger CTI platform when you need certified controls, broad stealer-log claims, or named-enterprise references today.', '/trust/security-overview'],
]

const dataHandling = [
    {
        title: 'Customer inputs',
        detail: 'Organization names, watched companies, domains, vendors, executives, API keys, webhook endpoints, user roles, and support context.',
    },
    {
        title: 'Alert records',
        detail: 'Matched term, source name, actor/company fields, timestamps, claim summary, status, confidence label, delivery result, and analyst review state.',
    },
    {
        title: 'Operational telemetry',
        detail: 'Request IDs, route health, delivery attempts, error states, service checks, audit events, and rate-limit events needed to secure and operate the service.',
    },
    {
        title: 'Excluded by default',
        detail: 'Hanasand does not require customers to upload raw leak dumps, malware, production secrets, or unnecessary personal data to receive company exposure alerts.',
    },
]

const subprocessorRows = [
    ['Hosting and runtime', 'Application, API, worker, processing, and scheduled-job infrastructure used to deliver the service.', 'Provider details supplied in the DPA packet until the public register is finalized.'],
    ['Database and storage', 'PostgreSQL-backed application data, alert records, audit events, and operational state.', 'Customer-managed deployments can replace Hanasand-managed storage by agreement.'],
    ['Mail and notification delivery', 'Account, support, alert, webhook, and operational email paths where configured.', 'Only the data required to deliver the message or alert is sent.'],
    ['Payment and billing', 'Subscription, invoice, and plan administration if a paid plan uses external billing rails.', 'Not used for customers handled by invoice/order form.'],
    ['Customer-selected integrations', 'Webhook, email, ticketing, SIEM, SOAR, Slack/Teams-style destinations, or internal tools configured by the customer.', 'Customer controls which downstream systems receive alert payloads.'],
]

const incidentSteps = [
    'Acknowledge security reports and route them to the operator responsible for the affected service.',
    'Triage whether customer data, alert delivery, credentials, webhooks, or source-processing integrity may be affected.',
    'Contain and rotate credentials or endpoints where needed, then preserve relevant audit records.',
    'Notify affected customers through the configured support or contract path when notification is required.',
]

export default function TrustPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.58fr)] lg:items-center'>
                    <div className='grid gap-5'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Trust center</p>
                        <h1 className='max-w-4xl text-4xl font-semibold tracking-normal md:text-6xl'>Enterprise review without fake badges.</h1>
                        <p className='max-w-3xl text-lg leading-8 text-ui-muted'>
                            Security buyers should be able to see what is real today, what is available by contract, and what is not certified yet. This page collects Hanasand security, procurement, data-handling, SLA, and onboarding facts in one place.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/contact?intent=procurement' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                Request procurement packet
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/status' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                View service status
                            </Link>
                        </div>
                    </div>

                    <aside className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4 shadow-sm'>
                        <div className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                            <p className='text-xs font-semibold uppercase text-ui-muted'>Current assurance state</p>
                            <div className='mt-4 grid gap-3'>
                                <TrustStat label='SOC 2 / ISO' value='Not certified' tone='warning' />
                                <TrustStat label='DPA / MSA' value='Request path live' tone='ready' />
                                <TrustStat label='Security overview' value='Published' tone='ready' />
                                <TrustStat label='SSO / SCIM' value='Scoped deal' tone='warning' />
                            </div>
                        </div>
                    </aside>
                </div>
            </section>

            <section id='security-overview' className='scroll-mt-24 border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-5 px-4 py-12 md:px-8'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Diligence packet</p>
                        <h2 className='mt-2 max-w-3xl text-3xl font-semibold'>What enterprise buyers can verify today.</h2>
                    </div>
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                        {assuranceCards.map((item) => {
                            const Icon = item.icon
                            return (
                                <Link key={item.title} href={item.href} className='group grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm transition hover:border-ui-primary'>
                                    <div className='flex items-start justify-between gap-3'>
                                        <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                            <Icon className='h-5 w-5' />
                                        </span>
                                        <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-muted'>{item.status}</span>
                                    </div>
                                    <div>
                                        <h3 className='text-lg font-semibold'>{item.title}</h3>
                                        <p className='mt-2 text-sm leading-6 text-ui-muted'>{item.detail}</p>
                                    </div>
                                    <span className='inline-flex items-center gap-2 text-sm font-semibold text-ui-primary'>
                                        Open artifact
                                        <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                    </span>
                                </Link>
                            )
                        })}
                    </div>
                    <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm md:grid-cols-[12rem_1fr] md:items-start'>
                        <div>
                            <p className='text-sm font-semibold uppercase text-ui-primary'>Public packet</p>
                            <p className='mt-2 text-sm leading-6 text-ui-muted'>Stable URLs a reviewer can inspect before opening a vendor portal.</p>
                        </div>
                        <div className='grid gap-2 md:grid-cols-2'>
                            {trustArtifacts.map((artifact) => (
                                <Link key={artifact.slug} href={`/trust/${artifact.slug}`} className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                    <span>{artifact.label}</span>
                                    <span className='text-xs text-ui-muted'>{artifact.status}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id='enterprise-controls' className='scroll-mt-24 border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8 lg:grid-cols-[0.72fr_1.28fr]'>
                    <div className='grid content-start gap-3'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Enterprise controls</p>
                        <h2 className='text-3xl font-semibold'>No mystery roadmap language.</h2>
                        <p className='text-sm leading-6 text-ui-muted'>
                            These rows are intentionally plain. If a procurement team needs a control that is not available now, it should be visible before a pilot starts.
                        </p>
                    </div>
                    <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-canvas shadow-sm'>
                        <div className='hidden grid-cols-[13rem_10rem_1fr] gap-3 border-b border-ui-border px-4 py-3 text-xs font-semibold uppercase text-ui-muted md:grid'>
                            <span>Control</span>
                            <span>Status</span>
                            <span>Buyer evidence</span>
                        </div>
                        <div className='divide-y divide-ui-border'>
                            {controlRows.map(([control, status, evidence]) => (
                                <div key={control} className='grid gap-3 px-4 py-4 text-sm md:grid-cols-[13rem_10rem_1fr]'>
                                    <span className='font-semibold text-ui-text'>{control}</span>
                                    <span className={`h-fit w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(status)}`}>{status}</span>
                                    <span className='leading-6 text-ui-muted'>{evidence}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id='buyer-evaluation' className='scroll-mt-24 border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8 lg:grid-cols-[0.78fr_1.22fr]'>
                    <div className='grid content-start gap-3'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Buyer evaluation path</p>
                        <h2 className='text-3xl font-semibold'>A faster way to decide whether Hanasand fits.</h2>
                        <p className='text-sm leading-6 text-ui-muted'>
                            Larger dark-web platforms can show more certifications, references, and coverage claims. Hanasand should win only when the buyer wants a direct watchlist-to-alert workflow and can verify the live product quickly.
                        </p>
                    </div>
                    <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                        <div className='hidden grid-cols-[12rem_1fr_8rem] gap-3 border-b border-ui-border px-4 py-3 text-xs font-semibold uppercase text-ui-muted md:grid'>
                            <span>Review step</span>
                            <span>What to verify</span>
                            <span className='text-right'>Path</span>
                        </div>
                        <div className='divide-y divide-ui-border'>
                            {buyerReviewRows.map(([step, detail, href]) => (
                                <div key={step} className='grid gap-3 px-4 py-4 text-sm md:grid-cols-[12rem_1fr_8rem] md:items-center'>
                                    <span className='font-semibold text-ui-text'>{step}</span>
                                    <span className='leading-6 text-ui-muted'>{detail}</span>
                                    <Link href={href} className='inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-text transition hover:border-ui-primary md:justify-self-end'>
                                        Open
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id='dpa-and-data' className='scroll-mt-24 border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8 lg:grid-cols-2'>
                    <InfoPanel
                        icon={<LockKeyhole className='h-5 w-5' />}
                        eyebrow='Security model'
                        title='Metadata-first monitoring'
                        body='The core monitoring path is designed around watchlists and alert metadata, not raw leak ingestion into customer dashboards.'
                    >
                        <div className='grid gap-3'>
                            {dataHandling.map((item) => (
                                <div key={item.title} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                    <h3 className='text-sm font-semibold text-ui-text'>{item.title}</h3>
                                    <p className='mt-1 text-sm leading-6 text-ui-muted'>{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    </InfoPanel>

                    <InfoPanel
                        icon={<Siren className='h-5 w-5' />}
                        eyebrow='Incident response'
                        title='Security report and breach-notification path'
                        body='Security concerns, suspected unauthorized access, webhook exposure, and responsible disclosure reports should be routed through support with enough detail to reproduce and scope the issue.'
                    >
                        <ol className='grid gap-3 text-sm leading-6 text-ui-muted'>
                            {incidentSteps.map((step, index) => (
                                <li key={step} className='grid grid-cols-[2rem_1fr] gap-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
                                    <span className='grid h-8 w-8 place-items-center rounded-md bg-ui-panel text-xs font-semibold text-ui-primary'>{index + 1}</span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>
                    </InfoPanel>
                </div>
            </section>

            <section id='subprocessors' className='scroll-mt-24 border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div>
                            <p className='text-sm font-semibold uppercase text-ui-primary'>Subprocessors and integrations</p>
                            <h2 className='mt-2 max-w-3xl text-3xl font-semibold'>Public categories, scoped provider details.</h2>
                        </div>
                        <Link href='/privacy' className='inline-flex h-11 w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                            Privacy policy
                        </Link>
                    </div>
                    <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-canvas shadow-sm'>
                        <div className='divide-y divide-ui-border'>
                            {subprocessorRows.map(([category, purpose, note]) => (
                                <div key={category} className='grid gap-2 px-4 py-4 text-sm md:grid-cols-[14rem_1fr_1fr] md:gap-4'>
                                    <span className='font-semibold text-ui-text'>{category}</span>
                                    <span className='leading-6 text-ui-muted'>{purpose}</span>
                                    <span className='leading-6 text-ui-muted'>{note}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id='sla-onboarding' className='scroll-mt-24 bg-ui-canvas'>
                <div className='mx-auto grid max-w-7xl gap-5 px-4 py-12 md:px-8 lg:grid-cols-[1fr_auto] lg:items-center'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Security review path</p>
                        <h2 className='mt-2 max-w-3xl text-3xl font-semibold'>Send the vendor portal, deadline, and required controls.</h2>
                        <p className='mt-3 max-w-3xl text-sm leading-6 text-ui-muted'>
                            Hanasand can package the current security overview, DPA request, subprocessor details, SLA notes, onboarding timeline, and questionnaire responses for a pilot or enterprise review.
                        </p>
                    </div>
                    <div className='flex flex-wrap gap-3 lg:justify-end'>
                        <Link href='/contact?intent=procurement' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                            Start security review
                            <ClipboardCheck className='h-4 w-4' />
                        </Link>
                        <Link href='/developers' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                            API and webhooks
                            <Webhook className='h-4 w-4' />
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}

function TrustStat({ label, value, tone }: { label: string; value: string; tone: 'ready' | 'warning' }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
            <span className='text-sm font-semibold text-ui-muted'>{label}</span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone === 'ready' ? 'border-ui-success bg-ui-success/15 text-ui-success' : 'border-ui-warning bg-ui-warning/15 text-ui-warning'}`}>{value}</span>
        </div>
    )
}

function InfoPanel({ icon, eyebrow, title, body, children }: { icon: ReactNode; eyebrow: string; title: string; body: string; children: ReactNode }) {
    return (
        <section className='grid gap-5 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
            <div className='grid gap-3'>
                <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>{icon}</span>
                <div>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>{eyebrow}</p>
                    <h2 className='mt-2 text-2xl font-semibold'>{title}</h2>
                    <p className='mt-2 text-sm leading-6 text-ui-muted'>{body}</p>
                </div>
            </div>
            {children}
        </section>
    )
}

function statusTone(status: string) {
    if (status === 'Available now') return 'border-ui-success bg-ui-success/15 text-ui-success'
    if (status === 'Not certified') return 'border-ui-danger bg-ui-danger/15 text-ui-danger'
    return 'border-ui-warning bg-ui-warning/15 text-ui-warning'
}
