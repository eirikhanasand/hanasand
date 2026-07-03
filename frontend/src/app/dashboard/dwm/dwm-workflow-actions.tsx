'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { Activity, BellRing, Loader2, Plus, RefreshCw, Send, ShieldCheck } from 'lucide-react'

type WorkflowResult = {
    ok: boolean
    message: string
}

export function DwmWorkflowActions({ tenantId, organizationId, initialTerms }: { tenantId: string, organizationId?: string, initialTerms: string[] }) {
    const router = useRouter()
    const [terms, setTerms] = useState(initialTerms.join('\n'))
    const [webhookUrl, setWebhookUrl] = useState('')
    const [sourceTarget, setSourceTarget] = useState('')
    const [claimActor, setClaimActor] = useState('')
    const [claimCompany, setClaimCompany] = useState('')
    const [claimData, setClaimData] = useState('')
    const [claimUrl, setClaimUrl] = useState('')
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [result, setResult] = useState<WorkflowResult | null>(null)
    const scope = organizationId ? { tenantId, organizationId } : { tenantId }

    function saveWatchlistTerms(nextTerms: string) {
        return postJson('/api/dwm/watchlists', {
            ...scope,
            name: 'Default company exposure watchlist',
            terms: nextTerms,
            webhookUrl: webhookUrl.trim() || undefined,
        })
    }

    async function saveWatchlist(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusyAction('watchlist')
        setResult(null)

        try {
            const create = await saveWatchlistTerms(terms)
            if (!create.ok) throw new Error(create.message)

            const rebuild = await postJson('/api/dwm/alerts/rebuild', scope)
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setResult({
                ok: rebuild.ok,
                message: rebuild.ok ? `Watchlist saved. Rebuilt ${savedAlertCount} alerts.` : rebuild.message,
            })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function ingestMetadataClaim(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusyAction('claim')
        setResult(null)

        const actor = claimActor.trim()
        const company = claimCompany.trim()
        const claimedData = claimData.trim() || 'new victim claim'
        const url = claimUrl.trim()
        const nextTerms = ensureTerm(terms, company)

        try {
            const ingest = await ingestClaim({ actor, company, claimedData, url }, scope)
            if (!ingest.ok) throw new Error(ingest.message)
            const accepted = typeof ingest.accepted === 'number' ? ingest.accepted : 0
            if (!accepted) throw new Error('No claim was accepted. Check the actor and victim fields.')

            const watchlist = await saveWatchlistTerms(nextTerms)
            if (!watchlist.ok) throw new Error(watchlist.message)

            const rebuild = await postJson('/api/dwm/alerts/rebuild', scope)
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setTerms(nextTerms)
            setClaimData('')
            setClaimUrl('')
            setResult({ ok: rebuild.ok, message: rebuild.ok ? `Ingested ${accepted} claim(s). Rebuilt ${savedAlertCount} alert(s).` : rebuild.message })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function openCaseFromMetadataClaim() {
        setBusyAction('claim-case')
        setResult(null)

        const actor = claimActor.trim()
        const company = claimCompany.trim()
        const claimedData = claimData.trim() || 'new victim claim'
        const url = claimUrl.trim()
        const nextTerms = ensureTerm(terms, company)

        try {
            const ingest = await ingestClaim({ actor, company, claimedData, url }, scope)
            const accepted = typeof ingest.accepted === 'number' ? ingest.accepted : 0
            if (!accepted) throw new Error('No claim was accepted. Check the actor and victim fields.')

            const watchlist = await saveWatchlistTerms(nextTerms)
            if (!watchlist.ok) throw new Error(watchlist.message)

            const rebuild = await postJson('/api/dwm/alerts/rebuild', scope)
            if (!rebuild.ok) throw new Error(rebuild.message)

            const alert = selectRebuiltAlert(rebuild, company, nextTerms)
            if (!alert?.id) throw new Error('No matching alert was generated for this claim.')

            const casePayload = await postJson(`/api/dwm/alerts/${encodeURIComponent(alert.id)}/case-handoff`, {
                ...scope,
                actor: 'dashboard',
                note: `Case opened from metadata claim for ${company}.`,
                idempotencyKey: `dashboard-metadata-claim-case:${alert.id}`,
            })
            if (!casePayload.ok) throw new Error(casePayload.message)

            const caseId = readNestedString(casePayload, ['case', 'id']) || readNestedString(casePayload, ['alertCaseHandoff', 'caseId'])
            let deliveryText = ''
            if (webhookConfigured) {
                const delivery = await postJson('/api/dwm/webhooks/deliver', {
                    ...scope,
                    alertId: alert.id,
                    caseId: caseId || undefined,
                    limit: 1,
                    dryRun: true,
                    webhookUrl: webhookUrl.trim(),
                    attachToWatchlist: true,
                })
                if (!delivery.ok) throw new Error(delivery.message)
                const attemptedCount = typeof delivery.attemptedCount === 'number' ? delivery.attemptedCount : 0
                deliveryText = attemptedCount ? ' Dry-run delivery recorded.' : ' No delivery was ready.'
            }

            setTerms(nextTerms)
            setClaimData('')
            setClaimUrl('')
            setResult({ ok: true, message: `Ingested ${accepted} claim(s), opened ${caseId || 'a case'}.${deliveryText}` })
            if (caseId) {
                router.push(caseDetailPath(caseId, alert.id, organizationId))
            } else {
                router.refresh()
            }
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function runSourcePackToCase() {
        setBusyAction('source-case')
        setResult(null)

        try {
            const watchlist = await saveWatchlistTerms(terms)
            if (!watchlist.ok) throw new Error(watchlist.message)

            const telegram = await postJson('/api/dwm/source-requests', {
                ...scope,
                seedPackIds: ['telegram-ransomware-claim-watch', 'telegram-stealer-broker-watch', 'telegram-regional-language-watch'],
                activate: true,
                limit: 60,
                scope: terms,
            })
            if (!telegram.ok) throw new Error(telegram.message)

            const darkweb = await postJson('/api/dwm/darkweb/approve-metadata', {
                ...scope,
                seedPackIds: ['darkweb-actor-metadata-core', 'darkweb-market-metadata-watch'],
                activate: true,
                approveMetadataOnly: true,
                approvedBy: 'dashboard',
                limit: 68,
                scope: terms,
            })
            if (!darkweb.ok) throw new Error(darkweb.message)

            const run = await postJson('/api/dwm/canary/run', {
                ...scope,
                operatorApproval: true,
                approvedBy: 'dashboard',
                maxSources: 48,
                maxTasks: 96,
            })
            if (!run.ok) throw new Error(run.message)

            const rebuild = await postJson('/api/dwm/alerts/rebuild', scope)
            if (!rebuild.ok) throw new Error(rebuild.message)
            const alert = selectRebuiltAlert(rebuild, '', terms)
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            if (!alert?.id) {
                const captureCount = readNumber(run.canaryRun, 'insertedCaptureCount')
                setResult({ ok: true, message: `Sources updated. Collected ${captureCount} capture(s) and rebuilt ${savedAlertCount} alert(s). No watchlist match opened a case.` })
                router.refresh()
                return
            }

            const casePayload = await postJson(`/api/dwm/alerts/${encodeURIComponent(alert.id)}/case-handoff`, {
                ...scope,
                actor: 'dashboard',
                note: 'Case opened from source-pack collection.',
                idempotencyKey: `dashboard-source-pack-case:${alert.id}`,
            })
            if (!casePayload.ok) throw new Error(casePayload.message)
            const caseId = readNestedString(casePayload, ['case', 'id']) || readNestedString(casePayload, ['alertCaseHandoff', 'caseId'])

            let deliveryText = ''
            if (webhookConfigured) {
                const delivery = await postJson('/api/dwm/webhooks/deliver', {
                    ...scope,
                    alertId: alert.id,
                    caseId: caseId || undefined,
                    limit: 1,
                    dryRun: true,
                    webhookUrl: webhookUrl.trim(),
                    attachToWatchlist: true,
                })
                if (!delivery.ok) throw new Error(delivery.message)
                const attemptedCount = typeof delivery.attemptedCount === 'number' ? delivery.attemptedCount : 0
                deliveryText = attemptedCount ? ' Dry-run delivery recorded.' : ' Delivery was not ready.'
            }

            const captureCount = readNumber(run.canaryRun, 'insertedCaptureCount')
            setResult({ ok: true, message: `Collected ${captureCount} capture(s), rebuilt ${savedAlertCount} alert(s), opened ${caseId || 'a case'}.${deliveryText}` })
            if (caseId) {
                router.push(caseDetailPath(caseId, alert.id, organizationId))
            } else {
                router.refresh()
            }
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function submitSource(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusyAction('source')
        setResult(null)

        try {
            const source = await postJson('/api/dwm/source-requests', {
                ...scope,
                target: sourceTarget,
                type: 'telegram_channel',
                priority: 'high',
                scope: terms,
                activate: true,
            })
            if (!source.ok) throw new Error(source.message)
            const duplicateOf = typeof source.duplicateOf === 'string' ? source.duplicateOf : ''
            setResult({ ok: true, message: duplicateOf ? `Already registered as ${duplicateOf}.` : 'Telegram source submitted for bounded public polling.' })
            setSourceTarget('')
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function runCollection() {
        setBusyAction('collection')
        setResult(null)

        try {
            const run = await postJson('/api/dwm/canary/run', {
                ...scope,
                operatorApproval: true,
                approvedBy: 'dashboard',
                maxSources: 12,
                maxTasks: 24,
            })
            if (!run.ok) throw new Error(run.message)

            const rebuild = await postJson('/api/dwm/alerts/rebuild', scope)
            const captureCount = readNumber(run.canaryRun, 'insertedCaptureCount')
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setResult({ ok: true, message: `Collected ${captureCount} Telegram captures. Rebuilt ${savedAlertCount} alerts.` })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function expandTelegramCoverage() {
        setBusyAction('telegram-pack')
        setResult(null)

        try {
            const applied = await postJson('/api/dwm/source-requests', {
                ...scope,
                seedPackIds: ['telegram-ransomware-claim-watch', 'telegram-stealer-broker-watch', 'telegram-regional-language-watch'],
                activate: true,
                limit: 60,
                scope: terms,
            })
            if (!applied.ok) throw new Error(applied.message)

            const run = await postJson('/api/dwm/canary/run', {
                ...scope,
                operatorApproval: true,
                approvedBy: 'dashboard',
                maxSources: 48,
                maxTasks: 96,
            })
            if (!run.ok) throw new Error(run.message)

            const rebuild = await postJson('/api/dwm/alerts/rebuild', scope)
            const summary = applied.summary && typeof applied.summary === 'object' ? applied.summary as Record<string, unknown> : {}
            const createdCount = typeof summary.telegramPublicCreated === 'number' ? summary.telegramPublicCreated : 0
            const duplicateCount = typeof summary.duplicateCount === 'number' ? summary.duplicateCount : 0
            const captureCount = readNumber(run.canaryRun, 'insertedCaptureCount')
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setResult({ ok: true, message: `Added ${createdCount} Telegram canary source(s), skipped ${duplicateCount} duplicate(s), collected ${captureCount} capture(s), rebuilt ${savedAlertCount} alert(s).` })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function approveDarkwebMetadata() {
        setBusyAction('darkweb')
        setResult(null)

        try {
            const approved = await postJson('/api/dwm/darkweb/approve-metadata', {
                ...scope,
                seedPackIds: ['darkweb-actor-metadata-core', 'darkweb-market-metadata-watch'],
                activate: true,
                approveMetadataOnly: true,
                approvedBy: 'dashboard',
                limit: 68,
                scope: terms,
            })
            if (!approved.ok) throw new Error(approved.message)
            const summary = approved.summary && typeof approved.summary === 'object' ? approved.summary as Record<string, unknown> : {}
            const count = typeof summary.darkwebMetadataCreated === 'number' ? summary.darkwebMetadataCreated : 0
            setResult({ ok: true, message: `Approved ${count} dark-web metadata source(s). No payload downloads enabled.` })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function deliverWebhooks() {
        setBusyAction('delivery')
        setResult(null)

        try {
            const delivery = await postJson('/api/dwm/webhooks/deliver', {
                ...scope,
                limit: 25,
            })
            if (!delivery.ok) throw new Error(delivery.message)
            const attemptedCount = typeof delivery.attemptedCount === 'number' ? delivery.attemptedCount : 0
            setResult({ ok: true, message: `Webhook delivery attempted for ${attemptedCount} alert(s).` })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function testWebhook() {
        setBusyAction('webhook-test')
        setResult(null)

        try {
            const test = await postJson('/api/dwm/webhooks/test', {
                ...scope,
                webhookUrl: webhookUrl.trim() || undefined,
            })
            if (!test.ok) throw new Error(test.message)
            setResult({ ok: true, message: 'Webhook test delivered. Future alerts can use this route.' })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    const termCount = countTerms(terms)
    const webhookConfigured = /^https?:\/\//i.test(webhookUrl.trim())
    const sourceReady = sourceTarget.trim().length > 0
    const claimReady = claimActor.trim().length > 0 && claimCompany.trim().length > 0
    const busy = busyAction !== null
    const saveDisabledReason = termCount ? '' : 'Add at least one company, domain, supplier, or product term first.'
    const sourceDisabledReason = sourceReady ? '' : 'Add a public Telegram handle or t.me URL first.'
    const claimDisabledReason = claimReady ? '' : 'Add the actor name and affected company before ingesting evidence.'
    const webhookTestDisabledReason = webhookConfigured ? '' : 'Enter an HTTPS webhook URL before testing delivery.'

    return (
        <div data-dwm-workflow-runbook className='grid gap-4'>
            <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                <RouteStateCard label='Watch terms' value={String(termCount)} detail={termCount ? 'Ready for matching' : 'Add terms before saving'} tone={termCount ? 'ok' : 'warn'} />
                <RouteStateCard label='Webhook URL' value={webhookConfigured ? 'Ready to test' : 'Not entered'} detail={webhookConfigured ? 'Test before customer send' : 'Optional, but required for test send'} tone={webhookConfigured ? 'ok' : 'warn'} />
                <RouteStateCard label='Source target' value={sourceReady ? 'Ready to submit' : 'No input'} detail={sourceReady ? sourceTarget.trim() : 'Add a public channel or use source expansion'} tone={sourceReady ? 'ok' : 'neutral'} />
                <RouteStateCard label='Last action' value={result ? result.ok ? 'Completed' : 'Review' : 'Waiting'} detail={result?.message || 'Run a step below to see the outcome here'} tone={result ? result.ok ? 'ok' : 'bad' : 'neutral'} />
            </section>

            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>First-run path</h2>
                        <p className='mt-1 text-sm leading-6 text-ui-muted'>Define matching terms, ingest source evidence, rebuild alerts, open a case, then test delivery.</p>
                    </div>
                    {result ? (
                        <p data-dwm-workflow-result className={`rounded-lg border px-3 py-2 text-sm ${result.ok ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'}`}>
                            {result.message}
                        </p>
                    ) : null}
                </div>
                <div className='mt-4 grid gap-2 md:grid-cols-4'>
                    <RunbookStep step='1' title='Terms' detail='Name the company, domains, suppliers, brands, and products that should open a case.' state={termCount ? 'ready' : 'needed'} />
                    <RunbookStep step='2' title='Sources' detail='Use approved public Telegram and metadata sources; private invites stay manual.' state='ready' />
                    <RunbookStep step='3' title='Cases' detail='Rebuild alerts after changing terms or collecting sources.' state={termCount ? 'ready' : 'waiting'} />
                    <RunbookStep step='4' title='Delivery' detail='Test an HTTPS webhook before sending customer notifications.' state={webhookConfigured ? 'ready' : 'waiting'} />
                </div>
            </section>

            <div className='grid gap-4 xl:grid-cols-2 2xl:grid-cols-[1.05fr_0.95fr_0.95fr]'>
                <form onSubmit={saveWatchlist} className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Customer watchlist</h2>
                            <p className='mt-1 text-sm leading-6 text-ui-muted'>Terms matched against collected evidence before an alert enters review or delivery.</p>
                        </div>
                        <BellRing className='h-5 w-5 text-ui-primary' />
                    </div>
                    <textarea
                        value={terms}
                        onChange={event => setTerms(event.target.value)}
                        placeholder={'acme.com\nAcme Payments\nNorthwind Supplier'}
                        className='mt-4 min-h-36 w-full resize-y rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <input
                        value={webhookUrl}
                        onChange={event => setWebhookUrl(event.target.value)}
                        placeholder='Webhook URL, optional'
                        className='mt-3 h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <button disabled={busy || Boolean(saveDisabledReason)} title={saveDisabledReason || undefined} className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'>
                            {busyAction === 'watchlist' ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                            Save and rebuild alerts
                        </button>
                        <WorkflowButton busy={busyAction === 'collection'} disabled={busy} icon={<RefreshCw className='h-4 w-4' />} onClick={runCollection}>Run Telegram collection</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'telegram-pack'} disabled={busy} icon={<Plus className='h-4 w-4' />} onClick={expandTelegramCoverage}>Expand Telegram</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'darkweb'} disabled={busy} icon={<ShieldCheck className='h-4 w-4' />} onClick={approveDarkwebMetadata}>Approve metadata</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'source-case'} disabled={busy || Boolean(saveDisabledReason)} disabledReason={saveDisabledReason || undefined} icon={<ShieldCheck className='h-4 w-4' />} onClick={runSourcePackToCase}>Run to case</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'delivery'} disabled={busy} icon={<Send className='h-4 w-4' />} onClick={deliverWebhooks}>Send webhooks</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'webhook-test'} disabled={busy || Boolean(webhookTestDisabledReason)} disabledReason={webhookTestDisabledReason} icon={<Send className='h-4 w-4' />} onClick={testWebhook}>Test webhook</WorkflowButton>
                    </div>
                    {saveDisabledReason ? <p className='mt-2 text-xs leading-5 text-ui-warning'>{saveDisabledReason}</p> : null}
                    {webhookTestDisabledReason ? <p className='mt-1 text-xs leading-5 text-ui-muted'>{webhookTestDisabledReason}</p> : null}
                </form>

                <form onSubmit={ingestMetadataClaim} className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Metadata claim intake</h2>
                            <p className='mt-1 text-sm leading-6 text-ui-muted'>Create a metadata-only source capture, add the victim to the watchlist, and rebuild alerts.</p>
                        </div>
                        <ShieldCheck className='h-5 w-5 text-ui-primary' />
                    </div>
                    <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                        <input
                            value={claimActor}
                            onChange={event => setClaimActor(event.target.value)}
                            placeholder='Actor'
                            className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                        />
                        <input
                            value={claimCompany}
                            onChange={event => setClaimCompany(event.target.value)}
                            placeholder='Affected company or domain'
                            className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                        />
                    </div>
                    <input
                        value={claimData}
                        onChange={event => setClaimData(event.target.value)}
                        placeholder='Claimed data, sector, or access type'
                        className='mt-3 h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <input
                        value={claimUrl}
                        onChange={event => setClaimUrl(event.target.value)}
                        placeholder='Source URL, optional'
                        className='mt-3 h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <button disabled={busy || Boolean(claimDisabledReason)} title={claimDisabledReason || undefined} className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'>
                            {busyAction === 'claim' ? <Loader2 className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}
                            Ingest and rebuild
                        </button>
                        <WorkflowButton busy={busyAction === 'claim-case'} disabled={busy || Boolean(claimDisabledReason)} disabledReason={claimDisabledReason || undefined} icon={<ShieldCheck className='h-4 w-4' />} onClick={openCaseFromMetadataClaim}>
                            Open case
                        </WorkflowButton>
                    </div>
                    {claimDisabledReason ? <p className='mt-2 text-xs leading-5 text-ui-muted'>{claimDisabledReason}</p> : null}
                </form>

                <form onSubmit={submitSource} className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Telegram source request</h2>
                            <p className='mt-1 text-sm leading-6 text-ui-muted'>Add a public @handle or t.me URL. Private invites stay out of automated collection.</p>
                        </div>
                        <Plus className='h-5 w-5 text-ui-primary' />
                    </div>
                    <input
                        value={sourceTarget}
                        onChange={event => setSourceTarget(event.target.value)}
                        placeholder='@breach_drop_house or https://t.me/channel'
                        className='mt-4 h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <button disabled={busy || Boolean(sourceDisabledReason)} title={sourceDisabledReason || undefined} className='mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'>
                        {busyAction === 'source' ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                        Submit source
                    </button>
                    {sourceDisabledReason ? <p className='mt-2 text-xs leading-5 text-ui-muted'>{sourceDisabledReason}</p> : null}
                </form>
            </div>
        </div>
    )
}

async function ingestClaim(input: { actor: string, company: string, claimedData: string, url: string }, scope: { tenantId: string, organizationId?: string }) {
    return postJson('/api/dwm/exposure-claims/ingest', {
        items: [{
            ...scope,
            actor: input.actor,
            company: input.company,
            claimedData: input.claimedData,
            sourceName: `${input.actor} metadata intake`,
            sourceFamily: 'darkweb_metadata',
            title: `${input.actor} has just published a new victim: ${input.company}`,
            text: `${input.actor} victim: ${input.company}. ${input.claimedData}.`,
            publishedAt: new Date().toISOString(),
            url: input.url || undefined,
        }],
    })
}

function selectRebuiltAlert(payload: Record<string, unknown>, company: string, terms: string) {
    const alerts = Array.isArray(payload.alerts) ? payload.alerts.filter(isRecord) : []
    const needles = [company, ...terms.split(/[\n,]/)].map(item => item.trim().toLowerCase()).filter(Boolean)
    const match = alerts.find(alert => {
        const companyValue = readString(alert.company).toLowerCase()
        const matchedValue = readNestedString(alert, ['matchedTerm', 'value']).toLowerCase()
        const summary = readString(alert.claimSummary).toLowerCase()
        return needles.some(needle => companyValue.includes(needle) || matchedValue.includes(needle) || summary.includes(needle))
    }) ?? alerts[0]
    const id = readString(match?.id)
    return id ? { id } : undefined
}

function caseDetailPath(caseId: string, alertId: string, organizationId?: string) {
    const params = new URLSearchParams()
    if (organizationId) params.set('organizationId', organizationId)
    params.set('alertId', alertId)
    return `/dashboard/dwm/cases/${encodeURIComponent(caseId)}?${params.toString()}`
}

function readNestedString(value: unknown, path: string[]) {
    let cursor = value
    for (const part of path) {
        if (!isRecord(cursor)) return ''
        cursor = cursor[part]
    }
    return readString(cursor)
}

function readString(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function RunbookStep({ step, title, detail, state }: { step: string, title: string, detail: string, state: 'ready' | 'needed' | 'waiting' }) {
    const toneClass = state === 'ready'
        ? 'border-ui-success/35 bg-ui-success/10 text-ui-success'
        : state === 'needed'
            ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
            : 'border-ui-border bg-ui-raised text-ui-muted'
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='flex items-center justify-between gap-3'>
                <span className='grid h-7 w-7 place-items-center rounded-full bg-ui-panel text-xs font-semibold text-ui-text'>{step}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>{state}</span>
            </div>
            <h3 className='mt-3 text-sm font-semibold text-ui-text'>{title}</h3>
            <p className='mt-1 line-clamp-3 text-xs leading-5 text-ui-muted'>{detail}</p>
        </div>
    )
}

function RouteStateCard({ label, value, detail, tone }: { label: string, value: string, detail: string, tone: 'ok' | 'warn' | 'bad' | 'neutral' }) {
    const toneClass = tone === 'ok'
        ? 'text-ui-success'
        : tone === 'warn'
            ? 'text-ui-warning'
            : tone === 'bad'
                ? 'text-ui-danger'
                : 'text-ui-primary'
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3 text-ui-muted'>
                <p className='text-xs font-semibold uppercase'>{label}</p>
                <Activity className='h-4 w-4' />
            </div>
            <p className={`mt-2 truncate text-lg font-semibold ${toneClass}`}>{value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-ui-muted'>{detail}</p>
        </div>
    )
}

function WorkflowButton({ busy, disabled, disabledReason, icon, onClick, children }: { busy: boolean, disabled: boolean, disabledReason?: string, icon: React.ReactNode, onClick: () => void, children: string }) {
    return (
        <button type='button' onClick={onClick} disabled={disabled} title={disabledReason || undefined} className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel disabled:cursor-not-allowed disabled:opacity-60'>
            {busy ? <Loader2 className='h-4 w-4 animate-spin' /> : icon}
            {children}
        </button>
    )
}

function countTerms(value: string) {
    return value.split(/[\n,]/).map(term => term.trim()).filter(Boolean).length
}

function ensureTerm(value: string, term: string) {
    const cleanTerm = term.trim()
    if (!cleanTerm) return value
    const terms = value.split(/[\n,]/).map(item => item.trim()).filter(Boolean)
    const exists = terms.some(item => item.toLowerCase() === cleanTerm.toLowerCase())
    return (exists ? terms : [...terms, cleanTerm]).join('\n')
}

async function postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown> & { ok: boolean, message: string }> {
    const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    const error = payload.error as { message?: string } | undefined
    return {
        ...payload,
        ok: response.ok,
        message: error?.message || response.statusText,
    }
}

function readNumber(value: unknown, key: string) {
    if (!value || typeof value !== 'object') return 0
    const candidate = (value as Record<string, unknown>)[key]
    return typeof candidate === 'number' ? candidate : 0
}
