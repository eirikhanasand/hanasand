'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { Activity, BellRing, Loader2, Plus, RefreshCw, Send, ShieldCheck } from 'lucide-react'

type WorkflowResult = {
    ok: boolean
    message: string
}

type WorkflowTelemetry = {
    activeSourceCount: number
    sourceCount: number
    captureCount: number
    watchlistMatchCount: number
    latestRunStatus?: string
    latestRunCaptureCount?: number
    alertCount: number
    deliveryCount: number
}

const STARTER_WATCH_TERMS = ['hanasand.com', 'Hanasand'] as const

export function DwmWorkflowActions({ tenantId, organizationId, initialTerms, telemetry }: { tenantId: string, organizationId?: string, initialTerms: string[], telemetry?: WorkflowTelemetry }) {
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
        const nextTerms = workflowTerms(terms)

        try {
            const create = await saveWatchlistTerms(nextTerms)
            if (!create.ok) throw new Error(create.message)

            const rebuild = await alertRebuildFromWatchlistOrRequest(create, scope)
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setTerms(nextTerms)
            setResult({
                ok: rebuild.ok,
                message: rebuild.ok ? `Watchlist saved. Matched ${savedAlertCount} alert${savedAlertCount === 1 ? '' : 's'}.` : rebuild.message,
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
        const claimedData = claimData.trim() || 'new exposure report'
        const url = claimUrl.trim()
        const nextTerms = ensureTerm(terms, company)

        try {
            const ingest = await ingestClaim({ actor, company, claimedData, url }, scope)
            if (!ingest.ok) throw new Error(ingest.message)
            const accepted = typeof ingest.accepted === 'number' ? ingest.accepted : 0
            if (!accepted) throw new Error('No exposure report was accepted. Check the actor and company fields.')

            const watchlist = await saveWatchlistTerms(nextTerms)
            if (!watchlist.ok) throw new Error(watchlist.message)

            const rebuild = await alertRebuildFromWatchlistOrRequest(watchlist, scope)
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setTerms(nextTerms)
            setClaimData('')
            setClaimUrl('')
            setResult({ ok: rebuild.ok, message: rebuild.ok ? `Ingested ${accepted} exposure report${accepted === 1 ? '' : 's'}. Matched ${savedAlertCount} alert${savedAlertCount === 1 ? '' : 's'}.` : rebuild.message })
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
        const claimedData = claimData.trim() || 'new exposure report'
        const url = claimUrl.trim()
        const nextTerms = ensureTerm(terms, company)

        try {
            const ingest = await ingestClaim({ actor, company, claimedData, url }, scope)
            const accepted = typeof ingest.accepted === 'number' ? ingest.accepted : 0
            if (!accepted) throw new Error('No exposure report was accepted. Check the actor and company fields.')

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
            setResult({ ok: true, message: `Ingested ${accepted} exposure report(s), opened ${caseId || 'a case'}.${deliveryText}` })
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
        const nextTerms = workflowTerms(terms)

        try {
            const watchlist = await saveWatchlistTerms(nextTerms)
            if (!watchlist.ok) throw new Error(watchlist.message)

            const telegram = await postJson('/api/dwm/source-requests', {
                ...scope,
                seedPackIds: ['telegram-ransomware-claim-watch', 'telegram-stealer-broker-watch', 'telegram-regional-language-watch'],
                activate: true,
                limit: 60,
                scope: nextTerms,
            })
            if (!telegram.ok) throw new Error(telegram.message)

            const darkweb = await postJson('/api/dwm/darkweb/approve-metadata', {
                ...scope,
                seedPackIds: ['darkweb-actor-metadata-core', 'darkweb-market-metadata-watch'],
                activate: true,
                approveMetadataOnly: true,
                approvedBy: 'dashboard',
                limit: 68,
                scope: nextTerms,
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
            const alert = selectRebuiltAlert(rebuild, '', nextTerms)
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            if (!alert?.id) {
                const captureCount = readNumber(run.canaryRun, 'insertedCaptureCount')
                setTerms(nextTerms)
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
            setTerms(nextTerms)
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
        const nextTerms = workflowTerms(terms)

        try {
            const watchlist = await saveWatchlistTerms(nextTerms)
            if (!watchlist.ok) throw new Error(watchlist.message)

            const applied = await postJson('/api/dwm/source-requests', {
                ...scope,
                seedPackIds: ['telegram-ransomware-claim-watch', 'telegram-stealer-broker-watch', 'telegram-regional-language-watch'],
                activate: true,
                limit: 60,
                scope: nextTerms,
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
            setTerms(nextTerms)
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
        const nextTerms = workflowTerms(terms)

        try {
            const watchlist = await saveWatchlistTerms(nextTerms)
            if (!watchlist.ok) throw new Error(watchlist.message)

            const approved = await postJson('/api/dwm/darkweb/approve-metadata', {
                ...scope,
                seedPackIds: ['darkweb-actor-metadata-core', 'darkweb-market-metadata-watch'],
                activate: true,
                approveMetadataOnly: true,
                approvedBy: 'dashboard',
                limit: 68,
                scope: nextTerms,
            })
            if (!approved.ok) throw new Error(approved.message)
            const summary = approved.summary && typeof approved.summary === 'object' ? approved.summary as Record<string, unknown> : {}
            const count = typeof summary.darkwebMetadataCreated === 'number' ? summary.darkwebMetadataCreated : 0
            setTerms(nextTerms)
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

    function seedStarterWatchlist() {
        if (countTerms(terms)) return
        setTerms(starterWatchTerms())
        setResult({ ok: true, message: 'Starter watchlist staged. Review the terms, then save or run to case.' })
    }

    const termCount = countTerms(terms)
    const effectiveTermCount = countTerms(workflowTerms(terms))
    const webhookConfigured = /^https?:\/\//i.test(webhookUrl.trim())
    const sourceReady = sourceTarget.trim().length > 0
    const claimReady = claimActor.trim().length > 0 && claimCompany.trim().length > 0
    const busy = busyAction !== null
    const sourceCount = telemetry?.sourceCount ?? 0
    const activeSourceCount = telemetry?.activeSourceCount ?? 0
    const captureCount = telemetry?.captureCount ?? 0
    const alertCount = telemetry?.alertCount ?? 0
    const deliveryCount = telemetry?.deliveryCount ?? 0
    const latestRunStatus = telemetry?.latestRunStatus || ''
    const latestRunCaptureCount = telemetry?.latestRunCaptureCount ?? 0
    const starterTermsActive = termCount === 0
    const sourceDisabledReason = sourceReady ? '' : 'Add a public Telegram handle or t.me URL first.'
    const claimDisabledReason = claimReady ? '' : 'Add the actor name and affected company before ingesting evidence.'
    const webhookTestDisabledReason = webhookConfigured ? '' : 'Enter an HTTPS webhook URL before testing delivery.'

    return (
        <div data-dwm-workflow-runbook className='grid gap-4 rounded-lg border border-[#26344d] bg-[#0b121e] p-4 text-[#edf4ff]'>
            <section className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#9db8ff]'>Collection command center</p>
                    <h2 className='mt-1 text-lg font-semibold tracking-normal text-[#edf4ff]'>Watchlist to case route</h2>
                    <p className='mt-1 max-w-3xl text-sm leading-6 text-[#aab7cc]'>Tune the org watchlist, collect approved sources, rebuild alerts, open cases, and test customer delivery from one path.</p>
                </div>
                {result ? (
                    <p data-dwm-workflow-result className={`max-w-xl rounded-lg border px-3 py-2 text-sm ${result.ok ? 'border-[#1f6f48] bg-[#0c261c] text-[#9cf0bc]' : 'border-[#7a3520] bg-[#2c160f] text-[#ffb598]'}`}>
                        {result.message}
                    </p>
                ) : null}
            </section>

            <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                <RouteStateCard label='Watch terms' value={String(effectiveTermCount)} detail={termCount ? 'Ready for matching' : 'Starter terms ready'} tone={termCount ? 'ok' : 'warn'} />
                <RouteStateCard label='Sources' value={`${activeSourceCount}/${sourceCount}`} detail={sourceCount ? 'Active monitored sources' : 'Run source pack or add a channel'} tone={activeSourceCount ? 'ok' : 'warn'} />
                <RouteStateCard label='Captures' value={String(captureCount)} detail={latestRunStatus ? `${latestRunStatus}${latestRunCaptureCount ? ` · ${latestRunCaptureCount} latest` : ''}` : 'No run loaded'} tone={captureCount ? 'ok' : 'neutral'} />
                <RouteStateCard label='Alerts' value={String(alertCount)} detail={`${telemetry?.watchlistMatchCount ?? 0} source match${(telemetry?.watchlistMatchCount ?? 0) === 1 ? '' : 'es'}`} tone={alertCount ? 'ok' : termCount ? 'warn' : 'neutral'} />
                <RouteStateCard label='Webhook' value={deliveryCount ? `${deliveryCount} attempt${deliveryCount === 1 ? '' : 's'}` : webhookConfigured ? 'URL ready' : 'Not tested'} detail={webhookConfigured ? 'Test before customer send' : 'Paste HTTPS endpoint to dry-run'} tone={deliveryCount || webhookConfigured ? 'ok' : 'warn'} />
            </section>

            <section className='overflow-hidden rounded-lg border border-[#26344d] bg-[#101827]'>
                <div className='overflow-x-auto'>
                    <table className='w-full min-w-[820px] text-left text-xs'>
                        <thead className='bg-[#0b121e] text-[10px] uppercase text-[#8fa0ba]'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Stage</th>
                                <th className='px-3 py-2 font-semibold'>Current state</th>
                                <th className='px-3 py-2 font-semibold'>Use next</th>
                                <th className='px-3 py-2 font-semibold'>Operator command</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#1f2c42]'>
                            <RouteStepRow stage='1. Watchlist' state={termCount ? `${termCount} terms saved or staged` : 'Starter terms staged on action'} next='Company, domain, supplier, brand, and product terms define alert scope.' command='Save and rebuild alerts' tone={termCount ? 'ok' : 'warn'} />
                            <RouteStepRow stage='2. Sources' state={sourceCount ? `${activeSourceCount}/${sourceCount} active` : 'No source inventory loaded'} next='Enable public Telegram and metadata-only source packs before relying on matches.' command='Expand Telegram / Approve metadata' tone={activeSourceCount ? 'ok' : 'warn'} />
                            <RouteStepRow stage='3. Captures' state={captureCount ? `${captureCount} safe captures` : 'No accepted captures'} next='Run collection to pull safe excerpts and metadata into the exposure queue.' command='Run Telegram collection' tone={captureCount ? 'ok' : 'neutral'} />
                            <RouteStepRow stage='4. Alert and case' state={alertCount ? `${alertCount} alerts in queue` : 'No active alert'} next='Rebuild after source changes, then open the alert as a case with provenance.' command='Run to case / Open case' tone={alertCount ? 'ok' : termCount ? 'warn' : 'neutral'} />
                            <RouteStepRow stage='5. Delivery' state={deliveryCount ? `${deliveryCount} delivery attempts` : webhookConfigured ? 'Webhook URL staged' : 'No delivery tested'} next='Use dry-run before sending customer notifications.' command='Test webhook / Send webhooks' tone={deliveryCount || webhookConfigured ? 'ok' : 'warn'} />
                        </tbody>
                    </table>
                </div>
            </section>

            <div className='grid gap-4 xl:grid-cols-2 2xl:grid-cols-[1.05fr_0.95fr_0.95fr]'>
                <form onSubmit={saveWatchlist} className='rounded-lg border border-[#26344d] bg-[#101827] p-4 shadow-sm'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#edf4ff]'>Customer watchlist</h2>
                            <p className='mt-1 text-sm leading-6 text-[#8fa0ba]'>Terms matched against collected evidence before an alert enters review or delivery.</p>
                        </div>
                        <BellRing className='h-5 w-5 text-[#9db8ff]' />
                    </div>
                    <textarea
                        value={terms}
                        onChange={event => setTerms(event.target.value)}
                        placeholder={'acme.com\nAcme Payments\nNorthwind Supplier'}
                        className='mt-4 min-h-36 w-full resize-y rounded-lg border border-[#27364f] bg-[#0b121e] px-3 py-2 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#60708a] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                    />
                    <input
                        value={webhookUrl}
                        onChange={event => setWebhookUrl(event.target.value)}
                        placeholder='Webhook URL, optional'
                        className='mt-3 h-10 w-full rounded-lg border border-[#27364f] bg-[#0b121e] px-3 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#60708a] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                    />
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <button disabled={busy} className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#9db8ff] px-4 text-sm font-semibold text-[#08111f] transition hover:bg-[#bfd0ff] disabled:cursor-not-allowed disabled:opacity-60'>
                            {busyAction === 'watchlist' ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                            Save and rebuild alerts
                        </button>
                        <WorkflowButton busy={busyAction === 'collection'} disabled={busy} icon={<RefreshCw className='h-4 w-4' />} onClick={runCollection}>Run Telegram collection</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'telegram-pack'} disabled={busy} icon={<Plus className='h-4 w-4' />} onClick={expandTelegramCoverage}>Expand Telegram</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'darkweb'} disabled={busy} icon={<ShieldCheck className='h-4 w-4' />} onClick={approveDarkwebMetadata}>Approve metadata</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'source-case'} disabled={busy} icon={<ShieldCheck className='h-4 w-4' />} onClick={runSourcePackToCase}>Run to case</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'delivery'} disabled={busy} icon={<Send className='h-4 w-4' />} onClick={deliverWebhooks}>Send webhooks</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'webhook-test'} disabled={busy || Boolean(webhookTestDisabledReason)} disabledReason={webhookTestDisabledReason} icon={<Send className='h-4 w-4' />} onClick={testWebhook}>Test webhook</WorkflowButton>
                        {starterTermsActive ? <WorkflowButton busy={false} disabled={busy} icon={<Plus className='h-4 w-4' />} onClick={seedStarterWatchlist}>Use hanasand.com</WorkflowButton> : null}
                    </div>
                    {starterTermsActive ? <p className='mt-2 text-xs leading-5 text-[#ffd58a]'>No saved terms yet. Actions will stage hanasand.com and Hanasand before collection.</p> : null}
                    {webhookTestDisabledReason ? <p className='mt-1 text-xs leading-5 text-[#8fa0ba]'>{webhookTestDisabledReason}</p> : null}
                </form>

                <form onSubmit={ingestMetadataClaim} className='rounded-lg border border-[#26344d] bg-[#101827] p-4 shadow-sm'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#edf4ff]'>Exposure intake</h2>
                            <p className='mt-1 text-sm leading-6 text-[#8fa0ba]'>Create a metadata-only capture, add the affected company to the watchlist, and rebuild alerts.</p>
                        </div>
                        <ShieldCheck className='h-5 w-5 text-[#9db8ff]' />
                    </div>
                    <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                        <input
                            value={claimActor}
                            onChange={event => setClaimActor(event.target.value)}
                            placeholder='Actor'
                            className='h-10 w-full rounded-lg border border-[#27364f] bg-[#0b121e] px-3 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#60708a] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                        />
                        <input
                            value={claimCompany}
                            onChange={event => setClaimCompany(event.target.value)}
                            placeholder='Affected company or domain'
                            className='h-10 w-full rounded-lg border border-[#27364f] bg-[#0b121e] px-3 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#60708a] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                        />
                    </div>
                    <input
                        value={claimData}
                        onChange={event => setClaimData(event.target.value)}
                        placeholder='Exposure details, sector, or access type'
                        className='mt-3 h-10 w-full rounded-lg border border-[#27364f] bg-[#0b121e] px-3 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#60708a] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                    />
                    <input
                        value={claimUrl}
                        onChange={event => setClaimUrl(event.target.value)}
                        placeholder='Source URL, optional'
                        className='mt-3 h-10 w-full rounded-lg border border-[#27364f] bg-[#0b121e] px-3 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#60708a] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                    />
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <button disabled={busy || Boolean(claimDisabledReason)} title={claimDisabledReason || undefined} className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#9db8ff] px-4 text-sm font-semibold text-[#08111f] transition hover:bg-[#bfd0ff] disabled:cursor-not-allowed disabled:opacity-60'>
                            {busyAction === 'claim' ? <Loader2 className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}
                            Ingest and rebuild
                        </button>
                        <WorkflowButton busy={busyAction === 'claim-case'} disabled={busy || Boolean(claimDisabledReason)} disabledReason={claimDisabledReason || undefined} icon={<ShieldCheck className='h-4 w-4' />} onClick={openCaseFromMetadataClaim}>
                            Open case
                        </WorkflowButton>
                    </div>
                    {claimDisabledReason ? <p className='mt-2 text-xs leading-5 text-[#8fa0ba]'>{claimDisabledReason}</p> : null}
                </form>

                <form onSubmit={submitSource} className='rounded-lg border border-[#26344d] bg-[#101827] p-4 shadow-sm'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#edf4ff]'>Telegram source request</h2>
                            <p className='mt-1 text-sm leading-6 text-[#8fa0ba]'>Add a public @handle or t.me URL. Private invites stay out of automated collection.</p>
                        </div>
                        <Plus className='h-5 w-5 text-[#9db8ff]' />
                    </div>
                    <input
                        value={sourceTarget}
                        onChange={event => setSourceTarget(event.target.value)}
                        placeholder='@breach_drop_house or https://t.me/channel'
                        className='mt-4 h-10 w-full rounded-lg border border-[#27364f] bg-[#0b121e] px-3 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#60708a] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                    />
                    <button disabled={busy || Boolean(sourceDisabledReason)} title={sourceDisabledReason || undefined} className='mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#9db8ff] px-4 text-sm font-semibold text-[#08111f] transition hover:bg-[#bfd0ff] disabled:cursor-not-allowed disabled:opacity-60'>
                        {busyAction === 'source' ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                        Submit source
                    </button>
                    {sourceDisabledReason ? <p className='mt-2 text-xs leading-5 text-[#8fa0ba]'>{sourceDisabledReason}</p> : null}
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

function RouteStepRow({ stage, state, next, command, tone }: { stage: string, state: string, next: string, command: string, tone: 'ok' | 'warn' | 'bad' | 'neutral' }) {
    const toneClass = tone === 'ok'
        ? 'border-[#1f6f48] bg-[#0c261c] text-[#9cf0bc]'
        : tone === 'warn'
            ? 'border-[#6f5417] bg-[#2a220f] text-[#ffd879]'
            : tone === 'bad'
                ? 'border-[#7a3520] bg-[#2c160f] text-[#ffb598]'
                : 'border-[#27364f] bg-[#0b121e] text-[#aab7cc]'
    return (
        <tr className='align-top transition hover:bg-[#111b2b]'>
            <td className='px-3 py-3'>
                <p className='text-sm font-semibold text-[#edf4ff]'>{stage}</p>
            </td>
            <td className='px-3 py-3'>
                <span className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
                    <span className='truncate' title={state}>{state}</span>
                </span>
            </td>
            <td className='px-3 py-3 text-sm leading-5 text-[#aab7cc]'>{next}</td>
            <td className='px-3 py-3 font-semibold text-[#dbe7ff]'>{command}</td>
        </tr>
    )
}

function RouteStateCard({ label, value, detail, tone }: { label: string, value: string, detail: string, tone: 'ok' | 'warn' | 'bad' | 'neutral' }) {
    const toneClass = tone === 'ok'
        ? 'text-[#9cf0bc]'
        : tone === 'warn'
            ? 'text-[#ffd58a]'
            : tone === 'bad'
                ? 'text-[#ffb598]'
                : 'text-[#9db8ff]'
    return (
        <div className='rounded-lg border border-[#26344d] bg-[#101827] p-4'>
            <div className='flex items-center justify-between gap-3 text-[#8fa0ba]'>
                <p className='text-xs font-semibold uppercase'>{label}</p>
                <Activity className='h-4 w-4' />
            </div>
            <p className={`mt-2 truncate text-lg font-semibold ${toneClass}`}>{value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-[#8fa0ba]'>{detail}</p>
        </div>
    )
}

function WorkflowButton({ busy, disabled, disabledReason, icon, onClick, children }: { busy: boolean, disabled: boolean, disabledReason?: string, icon: React.ReactNode, onClick: () => void, children: string }) {
    return (
        <button type='button' onClick={onClick} disabled={disabled} title={disabledReason || undefined} className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#27364f] bg-[#0b121e] px-4 text-sm font-semibold text-[#dbe7ff] transition hover:border-[#5f86ff] hover:bg-[#162033] disabled:cursor-not-allowed disabled:opacity-60'>
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

function starterWatchTerms() {
    return STARTER_WATCH_TERMS.join('\n')
}

function workflowTerms(value: string) {
    return countTerms(value) ? value : starterWatchTerms()
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

async function alertRebuildFromWatchlistOrRequest(payload: Record<string, unknown>, scope: { tenantId: string, organizationId?: string }) {
    const inlineRebuild = isRecord(payload.alertRebuild) ? payload.alertRebuild : null
    if (inlineRebuild) {
        return {
            ...inlineRebuild,
            ok: true,
            message: 'Watchlist matched against collected evidence.',
        }
    }
    return postJson('/api/dwm/alerts/rebuild', scope)
}

function readNumber(value: unknown, key: string) {
    if (!value || typeof value !== 'object') return 0
    const candidate = (value as Record<string, unknown>)[key]
    return typeof candidate === 'number' ? candidate : 0
}
