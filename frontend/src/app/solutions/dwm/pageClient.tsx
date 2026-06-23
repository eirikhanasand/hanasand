'use client'

import Link from 'next/link'
import { ArrowRight, BellRing, Building2, CheckCircle2, Code2, Copy, Radar, Webhook } from 'lucide-react'
import { useMemo, useState } from 'react'

const fields = [
    'actor',
    'company',
    'matchedTerm',
    'claimSummary',
    'claimedAt',
    'sourceName',
    'sourceUrl',
    'confidence',
    'recommendedAction',
]

const workflow = [
    {
        title: 'Watch the names that matter',
        detail: 'Add companies, domains, product names, suppliers, executives, and portfolio companies.',
        icon: Building2,
    },
    {
        title: 'Detect fresh actor mentions',
        detail: 'Use public indexes as seeds and owned collection for monitored actor-page metadata.',
        icon: Radar,
    },
    {
        title: 'Send the alert',
        detail: 'Deliver one event to a webhook, inbox, or review queue with the fields a team needs first.',
        icon: BellRing,
    },
]

const apiUseCases = [
    'Create tickets when a watched supplier appears in a new victim claim.',
    'Attach actor, company, claimed-data text, date, and source link to vendor-risk workflows.',
    'Keep the actor overview current without manually copying from public indexes.',
    'Route high-confidence company matches to Slack, Jira, SOAR, or a customer portal.',
]

const dwmWebhookDraftKey = 'hanasand:dwm-webhook-subscription'

export default function DarkWebMonitoringPage() {
    const [endpoint, setEndpoint] = useState('https://hooks.example.com/hanasand/dwm')
    const [watchlist, setWatchlist] = useState('acme.com, Acme Payments, Northwind supplier')
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
            setStatus('Add at least one company, domain, or vendor name.')
            return
        }
        const nextSubscriptionId = `dwm_${Date.now().toString(36)}`
        const draft = JSON.stringify({
            id: nextSubscriptionId,
            endpoint: trimmedEndpoint,
            terms,
            payload,
            createdAt: new Date().toISOString(),
        })
        writeWebhookDraft(draft)
        setSubscriptionId(nextSubscriptionId)
        setStatus(`Webhook setup saved for ${terms.length} watched term${terms.length === 1 ? '' : 's'}. Create the alert in the console to start monitoring.`)
        window.location.assign('/dashboard/automations?setup=dwm')
    }

    async function copyPayload() {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
        setStatus('Example webhook payload copied.')
    }

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] text-[#171a21]'>
            <section className='border-b border-[#e3e7ee] bg-white'>
                <div className='mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-8 md:py-20 lg:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)] lg:items-center'>
                    <div className='grid min-w-0 gap-6'>
                        <div className='grid gap-4'>
                            <p className='text-sm font-semibold uppercase text-[#3056d3]'>Dark web monitoring</p>
                            <h1 className='max-w-xl text-4xl font-semibold leading-tight tracking-normal md:text-5xl'>Know when an actor page mentions your company, vendor, or domain.</h1>
                            <p className='max-w-2xl text-lg leading-8 text-[#596170]'>
                                Hanasand monitors ransomware and extortion metadata, matches it to watchlists, and sends notification packets for security, vendor-risk, and executive-response teams.
                            </p>
                        </div>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/contact' className='inline-flex h-11 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                                Talk through coverage
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <Link href='/ti' className='inline-flex h-11 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5]'>
                                Open search
                            </Link>
                        </div>
                        <div className='grid gap-2 text-sm text-[#3d4656] sm:grid-cols-3'>
                            <Stat label='Best for' value='Company alerts' />
                            <Stat label='Delivery' value='Webhook + API' />
                            <Stat label='Output' value='Review-ready events' />
                        </div>
                    </div>

                    <div className='min-w-0 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-3 shadow-[0_22px_70px_rgba(26,35,55,0.12)]'>
                        <div className='min-w-0 rounded-lg border border-[#e2e8f0] bg-white'>
                            <div className='flex items-center justify-between border-b border-[#eef1f5] px-4 py-3'>
                                <div>
                                    <h2 className='text-sm font-semibold'>Webhook alert</h2>
                                    <p className='text-xs text-[#667085]'>Example payload sent when a watched term matches</p>
                                </div>
                                <span className='rounded-full bg-[#e9f8ef] px-2.5 py-1 text-xs font-semibold text-[#147a3b]'>Matched</span>
                            </div>
                            <pre className='max-h-[34rem] max-w-full overflow-auto p-4 text-xs leading-5 text-[#2b3340]'><code>{JSON.stringify(payload, null, 2)}</code></pre>
                        </div>
                    </div>
                </div>
            </section>

            <section className='border-b border-[#e3e7ee] bg-[#f7f8fb]'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8 lg:grid-cols-3'>
                    {workflow.map((item) => {
                        const Icon = item.icon
                        return (
                            <article key={item.title} className='grid gap-4 rounded-lg border border-[#e0e5ed] bg-white p-5 shadow-sm'>
                                <span className='grid h-11 w-11 place-items-center rounded-lg border border-[#dfe6f1] bg-[#f7f9fc] text-[#3056d3]'>
                                    <Icon className='h-5 w-5' />
                                </span>
                                <div className='grid gap-2'>
                                    <h2 className='text-lg font-semibold'>{item.title}</h2>
                                    <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                                </div>
                            </article>
                        )
                    })}
                </div>
            </section>

            <section className='bg-white'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8 lg:grid-cols-[0.86fr_1.14fr]'>
                    <div className='grid content-start gap-5'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>API and webhook delivery</p>
                        <h2 className='text-3xl font-semibold md:text-4xl'>Attach monitoring to the system your team already uses.</h2>
                        <p className='text-base leading-7 text-[#596170]'>
                            The API is useful because it turns scattered actor-page observations into stable fields: company, actor, matched term, claim text, source, timing, confidence, and recommended action.
                        </p>
                        <div className='grid gap-3'>
                            {apiUseCases.map(useCase => (
                                <div key={useCase} className='flex items-start gap-2 text-sm leading-6 text-[#3d4656]'>
                                    <CheckCircle2 className='mt-1 h-4 w-4 shrink-0 text-[#147a3b]' />
                                    <span>{useCase}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <section id='webhooks' className='scroll-mt-24 grid gap-5 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4 shadow-sm md:p-5'>
                        <div className='flex items-start justify-between gap-4'>
                            <div>
                                <h2 className='text-xl font-semibold'>Subscribe a webhook</h2>
                                <p className='mt-1 text-sm text-[#667085]'>Add an HTTPS endpoint, choose the names to watch, then create the alert schedule in the console.</p>
                            </div>
                            <Webhook className='h-5 w-5 text-[#3056d3]' />
                        </div>
                        <label htmlFor='dwm-webhook-endpoint' className='grid gap-2'>
                            <span className='text-sm font-semibold text-[#344054]'>Webhook endpoint</span>
                            <input id='dwm-webhook-endpoint' aria-label='Webhook endpoint' value={endpoint} onChange={event => updateEndpoint(event.target.value)} className={inputClass} placeholder='https://hooks.company.com/hanasand' />
                        </label>
                        <label htmlFor='dwm-watched-terms' className='grid gap-2'>
                            <span className='text-sm font-semibold text-[#344054]'>Watched terms</span>
                            <textarea id='dwm-watched-terms' aria-label='Watched terms' value={watchlist} onChange={event => updateWatchlist(event.target.value)} className={`${inputClass} min-h-28 resize-y`} placeholder='Company, domain, supplier, brand...' />
                        </label>
                        <div className='grid gap-3 md:grid-cols-[auto_auto_auto_1fr] md:items-center'>
                            <button type='button' onClick={prepareWebhookAlert} className='inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                                Prepare webhook alert
                                <ArrowRight className='h-4 w-4' />
                            </button>
                            <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5]'>
                                Create alert in console
                            </Link>
                            <button type='button' onClick={copyPayload} className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5]'>
                                <Copy className='h-4 w-4' />
                                Copy payload
                            </button>
                            {status ? <p className='text-sm font-medium text-[#3056d3]'>{status}</p> : null}
                        </div>
                        {subscriptionId ? (
                            <div className='rounded-lg border border-[#cfe8d8] bg-[#f3fbf6] px-3 py-2 text-sm text-[#146c36]'>
                                Draft ID: <span className='font-mono font-semibold'>{subscriptionId}</span>
                            </div>
                        ) : null}
                    </section>
                </div>
            </section>

            <section className='bg-[#f7f8fb]'>
                <div className='mx-auto grid max-w-7xl gap-5 px-4 py-14 md:px-8'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div className='grid gap-2'>
                            <p className='text-sm font-semibold uppercase text-[#3056d3]'>Fields customers pay for</p>
                            <h2 className='text-3xl font-semibold'>The alert is small because the decision is urgent.</h2>
                        </div>
                        <Link href='/developers' className='inline-flex w-fit items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 py-2.5 text-sm font-semibold text-[#171a21] transition hover:border-[#bdc7d5]'>
                            Developer notes
                            <Code2 className='h-4 w-4' />
                        </Link>
                    </div>
                    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                        {fields.map(field => <span key={field} className='rounded-lg border border-[#e0e5ed] bg-white px-4 py-3 font-mono text-sm text-[#3d4656] shadow-sm'>{field}</span>)}
                    </div>
                </div>
            </section>
        </main>
    )
}

const inputClass = 'rounded-lg border border-[#d8dee9] bg-white px-3 py-3 text-sm font-medium text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'

function writeWebhookDraft(draft: string) {
    try {
        window.localStorage.setItem(dwmWebhookDraftKey, draft)
    } catch {
        // Best effort: sessionStorage still supports the immediate handoff.
    }
    try {
        window.sessionStorage.setItem(dwmWebhookDraftKey, draft)
    } catch {
        // The visible confirmation remains useful even if browser storage is disabled.
    }
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className='rounded-lg border border-[#dfe5ee] bg-white p-3 shadow-sm'>
            <p className='text-xs uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}

function samplePayload(watchlist: string) {
    const matchedTerm = watchlist.split(',').map(item => item.trim()).filter(Boolean)[0] || 'acme.com'
    return {
        eventType: 'darkweb.monitoring.match',
        deliveredAt: '2026-06-23T08:16:44.000Z',
        severity: 'review',
        actor: 'Akira',
        company: 'Acme Payments',
        matchedTerm,
        claimSummary: 'Actor page lists a new victim claim and mentions financial records, contracts, and employee data.',
        claimedAt: '2026-06-23T07:58:00.000Z',
        sourceName: 'monitored actor page',
        sourceUrl: 'https://hanasand.com/ti?query=Acme%20Payments',
        confidence: 0.84,
        recommendedAction: 'Confirm the company match, notify vendor-risk or incident response, and watch for claim updates.',
        pivots: ['Akira', 'Acme Payments', matchedTerm, 'financial records'],
    }
}
