'use client'

import Link from 'next/link'
import { demoDwmProductSnapshot, dwmWebhookPayload } from '@/utils/dwm/product'
import {
    ArrowRight,
    Bot,
    CheckCircle2,
    Code2,
    Copy,
    Eye,
    Fingerprint,
    KeyRound,
    LockKeyhole,
    Radar,
    ShieldAlert,
    TicketCheck,
    Webhook,
} from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'

const snapshot = demoDwmProductSnapshot()
const activeSourceCount = snapshot.sourceCoverage.reduce((sum, source) => sum + source.activeCount, 0)
const totalSourceCount = snapshot.sourceCoverage.reduce((sum, source) => sum + source.sourceCount, 0)
const telegramCoverage = snapshot.sourceCoverage.find(source => source.family === 'telegram_public')
const darkwebCoverage = snapshot.sourceCoverage.find(source => source.family === 'darkweb_metadata')
const primarySnapshotAlert = snapshot.alerts[0]

const fields = [
    'actor',
    'company',
    'matchedTerm',
    'artifactType',
    'sourceFamily',
    'claimSummary',
    'firstSeenAt',
    'collectionPath',
    'confidence',
    'reviewState',
    'recommendedAction',
    'webhookDelivery',
]

const buyerSignals = [
    { label: 'Active monitored sources', value: activeSourceCount.toString(), detail: `${totalSourceCount} mapped across source families` },
    { label: 'Public Telegram sources', value: String(telegramCoverage?.activeCount || 0), detail: 'Broker rooms, mirrors, stealer-log shops' },
    { label: 'Metadata-only sources', value: String(darkwebCoverage?.activeCount || 0), detail: 'Actor pages, mirrors, hashes, screenshots' },
]

const exposureTypes = [
    { title: 'Credential leak', detail: 'Breach dumps, combo lists, reused passwords, and domain exposure counts.', icon: KeyRound },
    { title: 'Infostealer log', detail: 'Browser dumps, saved logins, cookies, autofill, corporate URLs, and seat-based resale.', icon: Fingerprint },
    { title: 'Session replay', detail: 'Live cookies, OAuth tokens, MFA bypass risk, and short-lived session artifacts.', icon: Bot },
    { title: 'Phishing-kit credentials', detail: 'Telegram exfil drops, AiTM kit posts, lures, hosting, and brand impersonation.', icon: ShieldAlert },
    { title: 'NHI compromise', detail: 'API keys, service accounts, OAuth apps, tokens, and machine identities.', icon: LockKeyhole },
]

const workflow = [
    {
        title: 'Discover',
        detail: 'Seed watchlists from domains, subsidiaries, brands, VIPs, suppliers, products, and portfolio companies.',
        icon: Eye,
    },
    {
        title: 'Monitor',
        detail: 'Continuously match across public Telegram, forums, markets, leak pages, advisories, and approved metadata sources.',
        icon: Radar,
    },
    {
        title: 'Act',
        detail: 'Ship a small alert with the artifact, source, confidence, recommended action, and handoff path.',
        icon: TicketCheck,
    },
    {
        title: 'Integrate',
        detail: 'Push reviewed alerts to webhooks, Slack, Jira, SIEM, SOAR, vendor-risk workflows, or the API.',
        icon: Webhook,
    },
]

const requestTypes = [
    { title: 'Telegram channels', detail: 'Public and approved invite-review queues for broker rooms, ransomware mirrors, and stealer-log markets.' },
    { title: 'New forums and markets', detail: 'Source onboarding packets for newly launched communities before they appear in generic indexes.' },
    { title: 'Actor or sector scopes', detail: 'Language, region, campaign, actor alias, industry, vendor, product, or portfolio monitoring windows.' },
    { title: 'Evidence-safe captures', detail: 'Metadata, hashes, screenshots, source timing, and redaction state without downloading stolen files.' },
]

const pricingTiers = [
    { name: 'Pilot', price: '$49/mo', detail: '25 watched names or domains, recent actor-claim matches, email notification packets.', href: '/contact?plan=pilot' },
    { name: 'Company Monitor', price: '$149/mo', detail: '250 watched names or domains, faster refresh cadence, structured alert export.', href: '/contact?plan=company-monitor', featured: true },
    { name: 'Portfolio', price: '$499/mo', detail: '1,500 watched names or domains, priority source expansion, custom delivery format.', href: '/contact?plan=portfolio' },
]

const faqItems = [
    {
        question: 'What is dark web monitoring?',
        answer: 'Dark web monitoring scans cybercrime sources for external threats linked to your organization, vendors, domains, brands, employees, and products. Hanasand keeps the output small: source, timing, match reason, confidence, and the next action.',
    },
    {
        question: 'Why is Telegram part of dark web monitoring?',
        answer: 'Threat actors increasingly move from static forums to Telegram rooms, mirrors, broker channels, stealer-log shops, and ephemeral drops. A useful service must monitor Telegram-like public channels as first-class sources, not as a side note.',
    },
    {
        question: 'What information is tracked?',
        answer: 'Credential leaks, infostealer logs, session cookies, API keys, OAuth tokens, phishing-kit drops, vendor claims, ransomware victim posts, data-type descriptions, actor aliases, source changes, and corroborating public reports.',
    },
    {
        question: 'Do you store stolen data?',
        answer: 'No. The product is built around metadata-only restricted collection, redaction, provenance, hashes, screenshots when approved, and customer-specific alert context. The goal is response speed without raw leaked-data bloat.',
    },
]

const apiUseCases = [
    'Create tickets when a watched supplier appears in a new victim claim.',
    'Route Telegram-originated hints into analyst review before they become customer-visible facts.',
    'Attach actor, company, claimed-data text, first-seen time, source family, and recommended action.',
    'Trigger identity-response workflows for session, OAuth, API-key, or infostealer-log exposure.',
]

const dwmWebhookDraftKey = 'hanasand:dwm-webhook-subscription'

export default function DarkWebMonitoringPage() {
    const [endpoint, setEndpoint] = useState('https://hooks.example.com/hanasand/dwm')
    const [watchlist, setWatchlist] = useState('acme.com, Acme Payments, Northwind supplier')
    const [requestTarget, setRequestTarget] = useState('t.me/broker_room_watch, Lumma, Okta session cookies')
    const [status, setStatus] = useState('')
    const [subscriptionId, setSubscriptionId] = useState('')
    const payload = useMemo(() => samplePayload(watchlist), [watchlist])

    function updateEndpoint(value: string) {
        setEndpoint(value)
        setSubscriptionId('')
    }

    function updateWatchlist(value: string) {
        setWatchlist(value)
        setSubscriptionId('')
    }

    function prepareWebhookAlert() {
        const trimmedEndpoint = endpoint.trim()
        const terms = watchlist.split(',').map(item => item.trim()).filter(Boolean)
        if (!/^https:\/\//i.test(trimmedEndpoint)) {
            setSubscriptionId('')
            setStatus('Use an HTTPS webhook endpoint.')
            return
        }
        if (!terms.length) {
            setSubscriptionId('')
            setStatus('Add at least one company, domain, vendor, brand, product, or VIP name.')
            return
        }
        const nextSubscriptionId = `dwm_${Date.now().toString(36)}`
        const draft = JSON.stringify({
            id: nextSubscriptionId,
            endpoint: trimmedEndpoint,
            terms,
            sourceFamilies: ['telegram_public', 'darkweb_metadata', 'actor_pages', 'public_advisory'],
            payload,
            createdAt: new Date().toISOString(),
        })
        writeWebhookDraft(draft)
        setSubscriptionId(nextSubscriptionId)
        setStatus(`Webhook setup saved for ${terms.length} watched term${terms.length === 1 ? '' : 's'}. Create the alert in the console to start monitoring.`)
        window.location.assign('/dashboard/automations?setup=dwm')
    }

    function submitCollectionRequest(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const target = requestTarget.trim()
        if (!target) {
            setStatus('Add a Telegram channel, actor, market, source, sector, or search scope.')
            return
        }
        setStatus(`Collection request staged: ${target}. The console will turn this into an approval packet before collection starts.`)
    }

    async function copyPayload() {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
        setStatus('Example webhook payload copied.')
    }

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#080a10] text-white'>
            <section className='border-b border-white/10 bg-[#080a10]'>
                <div className='mx-auto grid max-w-7xl gap-12 px-4 py-16 md:px-8 md:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:items-center'>
                    <div className='grid min-w-0 gap-7'>
                        <div className='grid gap-5'>
                            <p className='text-sm font-semibold uppercase tracking-[0.18em] text-[#9fb5ff]'>Dark web monitoring for security teams</p>
                            <h1 className='max-w-3xl text-5xl font-semibold leading-[1.04] tracking-normal md:text-7xl'>
                                Find company exposure before a buyer, journalist, or attacker does.
                            </h1>
                            <p className='max-w-2xl text-lg leading-8 text-[#c8d2e4]'>
                                Hanasand monitors Telegram, actor pages, leak-site metadata, public advisories, and security feeds for the names that matter to you. Every alert ships with source tracking, confidence, enrichment, and a review-ready next action.
                            </p>
                        </div>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/contact?intent=dwm' className='inline-flex h-12 items-center gap-2 rounded-lg bg-[#ff4d1d] px-5 text-sm font-semibold text-white transition hover:bg-[#ff6a3f]'>
                                Start monitoring
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/ti' className='inline-flex h-12 items-center gap-2 rounded-lg border border-[#5d6b86] bg-[#121722] px-5 text-sm font-semibold text-white transition hover:border-[#8ca2cf] hover:bg-[#182033]'>
                                Search intelligence
                            </Link>
                            <Link href='#webhooks' className='inline-flex h-12 items-center gap-2 rounded-lg border border-[#5d6b86] bg-[#121722] px-5 text-sm font-semibold text-white transition hover:border-[#8ca2cf] hover:bg-[#182033]'>
                                Preview webhook
                            </Link>
                        </div>
                        <div className='grid gap-3 border-t border-white/10 pt-5 text-sm text-[#d7dff0] sm:grid-cols-3'>
                            {buyerSignals.map(signal => <Metric key={signal.label} label={signal.label} value={signal.value} detail={signal.detail} />)}
                        </div>
                    </div>

                    <ThreatConsole payload={payload} />
                </div>
            </section>

            <section className='border-b border-white/10 bg-[#0c1018]'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center'>
                    <div className='grid gap-5'>
                        <p className='text-sm font-semibold uppercase tracking-[0.18em] text-[#9fb5ff]'>Telegram is the new dark web</p>
                        <h2 className='text-4xl font-semibold tracking-normal md:text-5xl'>Telegram coverage has to be a first-class product, not a promise.</h2>
                        <p className='text-base leading-7 text-[#c8d2e4]'>
                            Threat actors move from Tor forums to public and semi-public Telegram channels, exfil drops, broker rooms, ransomware mirrors, and stealer-log shops. Hanasand treats those streams as monitored sources with source health, approval state, parser confidence, and escalation paths.
                        </p>
                        <div className='grid gap-3 sm:grid-cols-2'>
                            <SmallFact label='Coverage model' value='Channels, mirrors, actors, campaigns' />
                            <SmallFact label='Processing' value='Parse, dedupe, score, route' />
                        </div>
                    </div>
                    <TelegramFeed />
                </div>
            </section>

            <section className='border-b border-white/10 bg-[#080a10]'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-16 md:px-8'>
                    <div className='grid max-w-4xl gap-3'>
                        <p className='text-sm font-semibold uppercase tracking-[0.18em] text-[#9fb5ff]'>Built for the analyst</p>
                        <h2 className='text-4xl font-semibold md:text-5xl'>No vanity feed. No bulk scraped-row bloat.</h2>
                        <p className='text-base leading-7 text-[#c8d2e4]'>Every alert needs to answer where it came from, why it matched, how urgent it is, and what to do next.</p>
                    </div>
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                        {workflow.map(item => {
                            const Icon = item.icon
                            return (
                                <article key={item.title} className='grid min-h-64 gap-5 rounded-lg border border-white/10 bg-[#10141f] p-5'>
                                    <span className='grid h-12 w-12 place-items-center rounded-lg border border-[#8e6dff]/50 bg-[#241b3b] text-[#b68cff]'>
                                        <Icon className='h-5 w-5' />
                                    </span>
                                    <div className='grid gap-2'>
                                        <h3 className='text-2xl font-semibold'>{item.title}</h3>
                                        <p className='text-sm leading-6 text-[#c8d2e4]'>{item.detail}</p>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className='border-b border-white/10 bg-[#0c1018]'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center'>
                    <div className='grid gap-6'>
                        <div className='grid gap-3'>
                            <p className='text-sm font-semibold uppercase tracking-[0.18em] text-[#9fb5ff]'>Dark web collection depth</p>
                            <h2 className='text-4xl font-semibold md:text-5xl'>Monitor the source graph, not just one public index.</h2>
                            <p className='text-base leading-7 text-[#c8d2e4]'>
                                Hanasand keeps restricted sources behind approval and metadata-only boundaries while still giving analysts the investigation shape: source family, first seen, mirror status, actor, victim, data type, hash, screenshot state, and retention.
                            </p>
                        </div>
                        <div className='grid gap-3'>
                            {snapshot.sourceCoverage.map(source => <CoverageRow key={source.family} source={source} />)}
                        </div>
                    </div>
                    <SourceHealthPanel />
                </div>
            </section>

            <section className='border-b border-white/10 bg-[#080a10]'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-16 md:px-8'>
                    <div className='grid max-w-4xl gap-3'>
                        <p className='text-sm font-semibold uppercase tracking-[0.18em] text-[#9fb5ff]'>Credential movement changed</p>
                        <h2 className='text-4xl font-semibold md:text-5xl'>Dark web monitoring built for sessions, tokens, APIs, and machine identities.</h2>
                        <p className='text-base leading-7 text-[#c8d2e4]'>
                            Password-only monitoring misses the most valuable exposure. Hanasand tracks the ways credentials move now: infostealer sessions, OAuth tokens, API keys, phishing-kit exfil, and non-human identities.
                        </p>
                    </div>
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
                        {exposureTypes.map(item => {
                            const Icon = item.icon
                            return (
                                <article key={item.title} className='grid min-h-56 gap-4 rounded-lg border border-white/10 bg-[#10141f] p-5'>
                                    <span className='grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-[#171d2a] text-[#c7d7ff]'>
                                        <Icon className='h-5 w-5' />
                                    </span>
                                    <div className='grid gap-2'>
                                        <h3 className='text-lg font-semibold'>{item.title}</h3>
                                        <p className='text-sm leading-6 text-[#aeb9cc]'>{item.detail}</p>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className='border-b border-white/10 bg-[#0c1018]'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center'>
                    <div className='grid gap-5'>
                        <p className='text-sm font-semibold uppercase tracking-[0.18em] text-[#9fb5ff]'>On-demand collection</p>
                        <h2 className='text-4xl font-semibold md:text-5xl'>Ask for the channel, actor, market, region, or vendor you actually care about.</h2>
                        <p className='text-base leading-7 text-[#c8d2e4]'>
                            Standard coverage is not enough. Submit a Telegram channel, new forum, actor alias, sector, language, or specific customer scope. Hanasand turns it into an approval packet, tests parser fit, and promotes safe sources into continuous monitoring.
                        </p>
                        <div className='grid gap-3 sm:grid-cols-2'>
                            {requestTypes.map(item => (
                                <article key={item.title} className='rounded-lg border border-white/10 bg-[#10141f] p-4'>
                                    <h3 className='font-semibold'>{item.title}</h3>
                                    <p className='mt-2 text-sm leading-6 text-[#aeb9cc]'>{item.detail}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                    <form onSubmit={submitCollectionRequest} className='grid gap-5 rounded-lg border border-[#7f5af0]/40 bg-[#171222] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)]'>
                        <div className='flex items-center justify-between gap-4'>
                            <div>
                                <p className='text-xs font-semibold uppercase tracking-[0.28em] text-[#b68cff]'>New request</p>
                                <h3 className='mt-2 text-2xl font-semibold'>Collection target</h3>
                            </div>
                            <span className='rounded-lg border border-[#ff4d1d]/50 bg-[#ff4d1d]/10 px-3 py-1 text-sm font-semibold text-[#ff8c6a]'>High</span>
                        </div>
                        <label className='grid gap-2'>
                            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-[#aeb9cc]'>Target</span>
                            <textarea value={requestTarget} onChange={event => setRequestTarget(event.target.value)} className='min-h-32 resize-y rounded-lg border border-white/10 bg-[#0c1018] px-3 py-3 font-mono text-sm text-white outline-none transition placeholder:text-[#667085] focus:border-[#b68cff] focus:ring-4 focus:ring-[#7f5af0]/20' />
                        </label>
                        <div className='grid gap-3 sm:grid-cols-2'>
                            <Token label='Scope' value='company + subsidiaries' />
                            <Token label='Window' value='90 days rolling' />
                            <Token label='Boundary' value='metadata only' />
                            <Token label='Approval' value='required' />
                        </div>
                        <button type='submit' className='inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-[#ff4d1d] px-4 text-sm font-semibold text-white transition hover:bg-[#ff6a3f]'>
                            Stage request
                            <ArrowRight className='h-4 w-4' />
                        </button>
                    </form>
                </div>
            </section>

            <section id='webhooks' className='scroll-mt-24 border-b border-white/10 bg-[#080a10]'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 lg:grid-cols-[0.86fr_1.14fr]'>
                    <div className='grid content-start gap-5'>
                        <p className='text-sm font-semibold uppercase tracking-[0.18em] text-[#9fb5ff]'>API and webhook delivery</p>
                        <h2 className='text-4xl font-semibold md:text-5xl'>Attach monitoring to the system your team already uses.</h2>
                        <p className='text-base leading-7 text-[#c8d2e4]'>
                            The API turns scattered observations into stable fields: company, actor, source family, date, artifact type, claim summary, confidence, review state, and recommended action.
                        </p>
                        <div className='grid gap-3'>
                            {apiUseCases.map(useCase => (
                                <div key={useCase} className='flex items-start gap-2 text-sm leading-6 text-[#d7dff0]'>
                                    <CheckCircle2 className='mt-1 h-4 w-4 shrink-0 text-[#53d18f]' />
                                    <span>{useCase}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <section className='grid gap-5 rounded-lg border border-white/10 bg-[#10141f] p-4 shadow-sm md:p-5'>
                        <div className='flex items-start justify-between gap-4'>
                            <div>
                                <h2 className='text-xl font-semibold'>Subscribe a webhook</h2>
                                <p className='mt-1 text-sm text-[#aeb9cc]'>Add an HTTPS endpoint and the terms to watch. The console creates the alert subscription.</p>
                            </div>
                            <Webhook className='h-5 w-5 text-[#9fb5ff]' />
                        </div>
                        <label htmlFor='dwm-webhook-endpoint' className='grid gap-2'>
                            <span className='text-sm font-semibold text-[#d7dff0]'>Webhook endpoint</span>
                            <input id='dwm-webhook-endpoint' aria-label='Webhook endpoint' value={endpoint} onChange={event => updateEndpoint(event.target.value)} className={inputClass} placeholder='https://hooks.company.com/hanasand' />
                        </label>
                        <label htmlFor='dwm-watched-terms' className='grid gap-2'>
                            <span className='text-sm font-semibold text-[#d7dff0]'>Watched terms</span>
                            <textarea id='dwm-watched-terms' aria-label='Watched terms' value={watchlist} onChange={event => updateWatchlist(event.target.value)} className={`${inputClass} min-h-28 resize-y`} placeholder='Company, domain, supplier, brand...' />
                        </label>
                        <div className='grid gap-3 md:grid-cols-[auto_auto_auto_1fr] md:items-center'>
                            <button type='button' onClick={prepareWebhookAlert} className='inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#ff4d1d] px-4 text-sm font-semibold text-white transition hover:bg-[#ff6a3f]'>
                                Subscribe webhook
                                <ArrowRight className='h-4 w-4' />
                            </button>
                            <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#5d6b86] bg-[#121722] px-4 text-sm font-semibold text-white transition hover:border-[#8ca2cf] hover:bg-[#182033]'>
                                Create alert
                            </Link>
                            <button type='button' onClick={copyPayload} className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#5d6b86] bg-[#121722] px-4 text-sm font-semibold text-white transition hover:border-[#8ca2cf] hover:bg-[#182033]'>
                                <Copy className='h-4 w-4' />
                                Copy payload
                            </button>
                            {status ? <p className='text-sm font-medium text-[#9fb5ff]'>{status}</p> : null}
                        </div>
                        {subscriptionId ? (
                            <div className='rounded-lg border border-[#53d18f]/30 bg-[#53d18f]/10 px-3 py-2 text-sm text-[#a9f0c7]'>
                                Draft ID: <span className='font-mono font-semibold'>{subscriptionId}</span>
                            </div>
                        ) : null}
                        <div className='rounded-lg border border-white/10 bg-[#080a10] p-3'>
                            <pre className='max-h-80 max-w-full overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-5 text-[#d7dff0]'><code>{JSON.stringify(payload, null, 2)}</code></pre>
                        </div>
                    </section>
                </div>
            </section>

            <section className='border-b border-white/10 bg-[#0c1018]'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-16 md:px-8'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div className='grid gap-2'>
                            <p className='text-sm font-semibold uppercase tracking-[0.18em] text-[#9fb5ff]'>Pricing and next step</p>
                            <h2 className='max-w-3xl text-4xl font-semibold md:text-5xl'>Start with a focused watchlist, then expand source coverage.</h2>
                        </div>
                        <Link href='/pricing' className='inline-flex h-11 w-fit items-center gap-2 rounded-lg border border-[#5d6b86] bg-[#121722] px-4 text-sm font-semibold text-white transition hover:border-[#8ca2cf] hover:bg-[#182033]'>
                            Full pricing
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                    <div className='grid gap-4 lg:grid-cols-3'>
                        {pricingTiers.map(tier => (
                            <article key={tier.name} className={`grid gap-4 rounded-lg border p-5 ${tier.featured ? 'border-[#ff4d1d]/60 bg-[#171222]' : 'border-white/10 bg-[#10141f]'}`}>
                                <div className='flex items-start justify-between gap-3'>
                                    <h3 className='text-xl font-semibold'>{tier.name}</h3>
                                    {tier.featured ? <span className='rounded-full bg-[#ff4d1d]/10 px-2.5 py-1 text-xs font-semibold text-[#ff8c6a]'>Best fit</span> : null}
                                </div>
                                <p className='text-3xl font-semibold'>{tier.price}</p>
                                <p className='text-sm leading-6 text-[#aeb9cc]'>{tier.detail}</p>
                                <Link href={tier.href} className={`inline-flex h-11 w-fit items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tier.featured ? 'bg-[#ff4d1d] text-white hover:bg-[#ff6a3f]' : 'border border-[#5d6b86] bg-[#121722] text-white hover:border-[#8ca2cf] hover:bg-[#182033]'}`}>
                                    Start this tier
                                    <ArrowRight className='h-4 w-4' />
                                </Link>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className='bg-[#0c1018]'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-16 md:px-8'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div className='grid gap-2'>
                            <p className='text-sm font-semibold uppercase tracking-[0.18em] text-[#9fb5ff]'>Fields customers pay for</p>
                            <h2 className='text-4xl font-semibold'>The alert is small because the decision is urgent.</h2>
                        </div>
                        <Link href='/developers' className='inline-flex w-fit items-center gap-2 rounded-lg border border-[#5d6b86] bg-[#121722] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#8ca2cf] hover:bg-[#182033]'>
                            Developer notes
                            <Code2 className='h-4 w-4' />
                        </Link>
                    </div>
                    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                        {fields.map(field => <span key={field} className='rounded-lg border border-white/10 bg-[#10141f] px-4 py-3 font-mono text-sm text-[#d7dff0]'>{field}</span>)}
                    </div>
                    <div className='grid gap-1 border-t border-white/10 pt-6'>
                        {faqItems.map(item => (
                            <details key={item.question} className='group border-b border-white/10 py-5'>
                                <summary className='flex cursor-pointer list-none items-center justify-between gap-4 text-2xl font-semibold'>
                                    {item.question}
                                    <ArrowRight className='h-5 w-5 rotate-45 text-[#9fb5ff] transition group-open:rotate-90' />
                                </summary>
                                <p className='mt-5 max-w-5xl text-base leading-7 text-[#c8d2e4]'>{item.answer}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    )
}

const inputClass = 'rounded-lg border border-white/10 bg-[#080a10] px-3 py-3 text-sm font-medium text-white outline-none transition placeholder:text-[#667085] focus:border-[#9fb5ff] focus:ring-4 focus:ring-[#3056d3]/20'

function ThreatConsole({ payload }: { payload: ReturnType<typeof samplePayload> }) {
    const alert = primarySnapshotAlert
    const webhookPreview = dwmWebhookPayload(alert)

    return (
        <div className='relative min-w-0 rounded-lg border border-[#7f5af0]/40 bg-[#12101d] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.45)]'>
            <div className='absolute -right-4 top-14 hidden rounded-lg border border-white/10 bg-[#10141f] px-4 py-3 shadow-2xl md:block'>
                <p className='text-xs font-semibold uppercase tracking-[0.22em] text-[#aeb9cc]'>First seen</p>
                <p className='mt-1 font-semibold text-white'>6 min ago</p>
            </div>
            <div className='absolute -bottom-8 left-8 hidden rounded-lg border border-white/10 bg-[#10141f] px-4 py-3 shadow-2xl md:block'>
                <p className='text-xs font-semibold uppercase tracking-[0.22em] text-[#aeb9cc]'>Sources scanned</p>
                <p className='mt-1 font-semibold text-white'>Forums · Markets · Telegram</p>
            </div>
            <div className='flex items-center justify-between border-b border-white/10 pb-4'>
                <div>
                    <p className='font-mono text-xs uppercase tracking-[0.28em] text-[#ff8c6a]'>Critical</p>
                    <h2 className='mt-2 text-2xl font-semibold'>Identify exposure</h2>
                </div>
                <span className='rounded-full bg-[#ff4d1d]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6a3f]'>Live</span>
            </div>
            <div className='grid gap-3 py-5'>
                <AlertRow dot='bg-[#ff4d1d]' title={`${alert.artifactType.replaceAll('_', ' ')} · ${alert.actor || 'Actor'}`} detail={`${alert.sourceCount} sources · ${alert.confidence}% confidence · ${alert.reviewState.replaceAll('_', ' ')}`} time='02:14' />
                <AlertRow dot='bg-[#b68cff]' title='Active session cookie · Okta' detail='TTL 18m · origin RU · bypasses MFA' time='02:12' />
                <AlertRow dot='bg-[#9fb5ff]' title='AWS IAM key · scope:* admin' detail='Gist mirror · re-listed · matched supplier' time='02:03' />
                <AlertRow dot='bg-[#53d18f]' title='Actor page claim · Akira' detail={`${payload.company} · ${payload.matchedTerm} · needs review`} time='01:58' />
            </div>
            <div className='grid gap-3 rounded-lg border border-white/10 bg-[#080a10] p-4'>
                <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                        <span className='grid h-11 w-11 place-items-center rounded-full bg-[#7f5af0] font-semibold'>HS</span>
                        <div>
                            <h3 className='font-semibold'>{payload.company}</h3>
                            <p className='text-sm text-[#aeb9cc]'>{payload.reviewState} · {payload.confidence}% confidence</p>
                        </div>
                    </div>
                    <span className='rounded-lg border border-[#7f5af0]/50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b68cff]'>VIP</span>
                </div>
                <p className='text-sm leading-6 text-[#c8d2e4]'>{payload.recommendedAction}</p>
                <div className='grid gap-2 rounded-lg border border-white/10 bg-[#10141f] p-3'>
                    <p className='text-xs font-semibold uppercase tracking-[0.18em] text-[#8d96a8]'>Webhook preview</p>
                    <div className='grid gap-2 font-mono text-xs text-[#d7dff0] sm:grid-cols-2'>
                        <span>route: {alert.webhookDelivery.recommendedRoute}</span>
                        <span>dedupe: {webhookPreview.delivery.dedupeKey}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function AlertRow({ dot, title, detail, time }: { dot: string; title: string; detail: string; time: string }) {
    return (
        <div className='grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-[#151a26] p-3'>
            <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            <div className='min-w-0'>
                <p className='truncate font-semibold text-white'>{title}</p>
                <p className='truncate font-mono text-sm text-[#aeb9cc]'>{detail}</p>
            </div>
            <span className='font-mono text-xs text-[#8d96a8]'>{time}</span>
        </div>
    )
}

function TelegramFeed() {
    const rows = [
        ['BR', '@breach_drop_house', 'Selling internal dump · sample post on mirror', '02:08'],
        ['SE', '@session_replay_market', '12 live tokens · Office365 · CRM · auto-rotated 24h', '02:05'],
        ['NH', '@nhi_keystore', 'AWS IAM admin · seller offers escrow · API key match', '02:03'],
        ['PH', '@phishing_brand_alley', 'Lookalike domain registered · launching Monday', '01:59'],
        ['RA', '@ransom_press_room', 'Affiliate post · victim claim · 48h countdown', '01:57'],
    ]
    return (
        <div className='rounded-lg border border-white/10 bg-[#10141f] p-4'>
            <div className='mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4'>
                <div className='flex items-center gap-2'>
                    <span className='h-3 w-3 rounded-full bg-[#667085]' />
                    <span className='h-3 w-3 rounded-full bg-[#667085]' />
                    <span className='h-3 w-3 rounded-full bg-[#667085]' />
                    <span className='ml-3 font-mono text-sm text-[#aeb9cc]'>hanasand://intel/feed/telegram</span>
                </div>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6a3f]'>Live</span>
            </div>
            <div className='grid gap-3'>
                {rows.map(([initials, handle, text, time]) => (
                    <div key={handle} className='grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-[#151a26] p-3'>
                        <span className='grid h-11 w-11 place-items-center rounded-full bg-[#4f63d9] font-semibold'>{initials}</span>
                        <div className='min-w-0'>
                            <p className='truncate font-mono text-sm font-semibold text-[#d7dff0]'>{handle}</p>
                            <p className='truncate text-sm text-[#aeb9cc]'>{text}</p>
                        </div>
                        <span className='font-mono text-xs text-[#8d96a8]'>{time}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function SourceHealthPanel() {
    return (
        <div className='overflow-hidden rounded-lg border border-white/10 bg-[#10141f] shadow-[0_30px_90px_rgba(0,0,0,0.24)]'>
            <div className='border-b border-white/10 bg-[#151a26] p-4'>
                <p className='font-mono text-xs uppercase tracking-[0.22em] text-[#8d96a8]'>Source operations</p>
                <h3 className='mt-2 text-2xl font-semibold'>Coverage health board</h3>
            </div>
            <div className='grid gap-0'>
                {snapshot.sourceCoverage.map(source => {
                    const percent = Math.round((source.activeCount / source.sourceCount) * 100)
                    return (
                        <div key={source.family} className='grid gap-3 border-b border-white/10 p-4 last:border-b-0'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <h4 className='font-semibold'>{source.label}</h4>
                                    <p className='mt-1 font-mono text-xs text-[#8d96a8]'>{source.family}</p>
                                </div>
                                <span className='rounded-full border border-[#5d6b86] px-2.5 py-1 text-xs font-semibold capitalize text-[#d7dff0]'>{source.approvalState.replaceAll('_', ' ')}</span>
                            </div>
                            <div>
                                <div className='mb-1 flex items-center justify-between text-xs text-[#aeb9cc]'>
                                    <span>{source.activeCount}/{source.sourceCount} active</span>
                                    <span>{source.health}</span>
                                </div>
                                <div className='h-2 overflow-hidden rounded-full bg-white/10'>
                                    <div className='h-full rounded-full bg-[#53d18f]' style={{ width: `${percent}%` }} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function CoverageRow({ source }: { source: typeof snapshot.sourceCoverage[number] }) {
    const toneClass = source.health === 'healthy' ? 'text-[#53d18f] bg-[#53d18f]/10 border-[#53d18f]/30' : source.health === 'partial' ? 'text-[#ff8c6a] bg-[#ff4d1d]/10 border-[#ff4d1d]/30' : 'text-[#b68cff] bg-[#7f5af0]/10 border-[#7f5af0]/30'
    return (
        <article className='grid gap-3 rounded-lg border border-white/10 bg-[#10141f] p-4 md:grid-cols-[1fr_auto] md:items-center'>
            <div>
                <h3 className='font-semibold'>{source.label}</h3>
                <p className='mt-1 text-sm leading-6 text-[#aeb9cc]'>{source.detail}</p>
            </div>
            <span className={`w-fit rounded-lg border px-3 py-1 text-sm font-semibold ${toneClass}`}>{source.activeCount}/{source.sourceCount} active</span>
        </article>
    )
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <div>
            <p className='text-xs uppercase tracking-[0.16em] text-[#8d96a8]'>{label}</p>
            <p className='mt-1 font-semibold text-white'>{value}</p>
            {detail ? <p className='mt-1 text-xs leading-5 text-[#8d96a8]'>{detail}</p> : null}
        </div>
    )
}

function SmallFact({ label, value }: { label: string; value: string }) {
    return (
        <div className='rounded-lg border border-white/10 bg-[#10141f] p-4'>
            <p className='text-xs uppercase tracking-[0.16em] text-[#8d96a8]'>{label}</p>
            <p className='mt-2 font-semibold text-white'>{value}</p>
        </div>
    )
}

function Token({ label, value }: { label: string; value: string }) {
    return (
        <div className='rounded-lg border border-white/10 bg-[#0c1018] p-3'>
            <p className='text-xs uppercase tracking-[0.16em] text-[#8d96a8]'>{label}</p>
            <p className='mt-1 font-mono text-sm text-[#d7dff0]'>{value}</p>
        </div>
    )
}

function writeWebhookDraft(draft: string) {
    try {
        window.localStorage.setItem(dwmWebhookDraftKey, draft)
    } catch {
        // Best effort: sessionStorage still supports the immediate setup flow.
    }
    try {
        window.sessionStorage.setItem(dwmWebhookDraftKey, draft)
    } catch {
        // The visible confirmation remains useful even if browser storage is disabled.
    }
}

function samplePayload(watchlist: string) {
    const matchedTerm = watchlist.split(',').map(item => item.trim()).filter(Boolean)[0] || 'acme.com'
    return {
        eventType: 'darkweb.monitoring.match',
        deliveredAt: '2026-06-27T08:16:44.000Z',
        severity: 'critical',
        actor: 'Akira',
        company: 'Acme Payments',
        matchedTerm,
        artifactType: 'telegram_stealer_log_hint',
        sourceFamily: 'telegram_public + restricted_metadata',
        sourceName: 'monitored Telegram broker room and actor-page metadata',
        sourceUrl: 'https://hanasand.com/ti/Acme%20Payments',
        claimSummary: 'Telegram broker post and actor-page metadata mention a watched company, corporate URLs, session artifacts, and claimed financial records.',
        firstSeenAt: '2026-06-27T08:10:00.000Z',
        confidence: 88,
        sourceCount: 5,
        reviewState: 'needs_review',
        recommendedAction: 'Confirm the company match, rotate exposed sessions or keys if present, notify vendor-risk or incident response, and keep the actor page on a 30-minute watch.',
        pivots: ['Akira', 'Acme Payments', matchedTerm, 'Lumma', 'session cookies', 'financial records'],
        webhookDelivery: {
            retryPolicy: 'signed delivery with retry and dead-letter review',
            destinations: ['Slack', 'Jira', 'SIEM', 'SOAR', 'vendor-risk portal'],
        },
    }
}
