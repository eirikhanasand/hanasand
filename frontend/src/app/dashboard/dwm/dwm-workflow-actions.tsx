'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useRef, useState } from 'react'
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

type WorkflowRouteSummary = {
    label: string
    at: string
    watchTerms: number
    sourceCount?: number
    captureCount?: number
    alertCount?: number
    alertId?: string
    caseId?: string
    caseHref?: string
    deliveryAttempts?: number
    deliveryState?: string
}

const STARTER_WATCH_TERMS = ['your-company.com', 'Primary supplier', 'Customer brand'] as const

export function DwmWorkflowActions({ tenantId, organizationId, initialTerms, telemetry }: { tenantId: string, organizationId?: string, initialTerms: string[], telemetry?: WorkflowTelemetry }) {
    const router = useRouter()
    const webhookInputRef = useRef<HTMLInputElement>(null)
    const [terms, setTerms] = useState(initialTerms.join('\n'))
    const [webhookUrl, setWebhookUrl] = useState('')
    const [sourceTarget, setSourceTarget] = useState('')
    const [claimActor, setClaimActor] = useState('')
    const [claimCompany, setClaimCompany] = useState('')
    const [claimData, setClaimData] = useState('')
    const [claimUrl, setClaimUrl] = useState('')
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [result, setResult] = useState<WorkflowResult | null>(null)
    const [lastRoute, setLastRoute] = useState<WorkflowRouteSummary | null>(null)
    const scope = organizationId ? { tenantId, organizationId } : { tenantId }

    function saveWatchlistTerms(nextTerms: string) {
        return postJson('/api/dwm/watchlists', {
            ...scope,
            name: 'Default company exposure watchlist',
            terms: nextTerms,
            webhookUrl: webhookUrl.trim() || undefined,
        })
    }

    function enablePublicAdvisorySources(nextTerms: string, limit = 24) {
        return postJson('/api/dwm/source-requests', {
            ...scope,
            seedPackIds: ['public-advisory-exposure-watch'],
            activate: true,
            approvedBy: 'dashboard',
            limit,
            scope: nextTerms,
        })
    }

    async function saveAndRebuildWatchlist() {
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
            setLastRoute({
                label: 'Watchlist match',
                at: new Date().toISOString(),
                watchTerms: countTerms(nextTerms),
                alertCount: savedAlertCount,
            })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function saveWatchlist(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        await saveAndRebuildWatchlist()
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
            setLastRoute({
                label: 'Metadata intake',
                at: new Date().toISOString(),
                watchTerms: countTerms(nextTerms),
                captureCount: accepted,
                alertCount: savedAlertCount,
            })
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
            setLastRoute({
                label: 'Metadata case',
                at: new Date().toISOString(),
                watchTerms: countTerms(nextTerms),
                captureCount: accepted,
                alertCount: 1,
                alertId: alert.id,
                caseId: caseId || undefined,
                caseHref: caseId ? caseDetailPath(caseId, alert.id, organizationId, 'metadata_claim') : undefined,
                deliveryAttempts: deliveryText ? (deliveryText.includes('recorded') ? 1 : 0) : undefined,
                deliveryState: deliveryText ? deliveryText.trim() : undefined,
            })
            setResult({ ok: true, message: `Ingested ${accepted} exposure report(s), opened ${caseId || 'a case'}.${deliveryText}` })
            if (caseId) {
                router.push(caseDetailPath(caseId, alert.id, organizationId, 'metadata_claim'))
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

            const advisory = await enablePublicAdvisorySources(nextTerms, 24)
            if (!advisory.ok) throw new Error(advisory.message)

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
            const captureCount = readNumber(run.canaryRun, 'insertedCaptureCount')
            const telegramCount = readSummaryNumber(telegram, 'telegramPublicCreated')
            const darkwebCount = readSummaryNumber(darkweb, 'darkwebMetadataCreated')
            const advisorySummary = advisory.summary && typeof advisory.summary === 'object' ? advisory.summary as Record<string, unknown> : {}
            const advisoryCount = typeof advisorySummary.publicAdvisoryCreated === 'number' ? advisorySummary.publicAdvisoryCreated : 0
            if (!alert?.id) {
                setTerms(nextTerms)
                setLastRoute({
                    label: 'Source pack run',
                    at: new Date().toISOString(),
                    watchTerms: countTerms(nextTerms),
                    sourceCount: telegramCount + darkwebCount + advisoryCount,
                    captureCount,
                    alertCount: savedAlertCount,
                })
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
            let deliveryAttempts: number | undefined
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
                deliveryAttempts = attemptedCount
                deliveryText = attemptedCount ? ' Dry-run delivery recorded.' : ' Delivery was not ready.'
            }

            setTerms(nextTerms)
            setLastRoute({
                label: 'Full workflow',
                at: new Date().toISOString(),
                watchTerms: countTerms(nextTerms),
                sourceCount: telegramCount + darkwebCount + advisoryCount,
                captureCount,
                alertCount: savedAlertCount,
                alertId: alert.id,
                caseId: caseId || undefined,
                caseHref: caseId ? caseDetailPath(caseId, alert.id, organizationId, 'source_pack') : undefined,
                deliveryAttempts,
                deliveryState: deliveryText ? deliveryText.trim() : undefined,
            })
            setResult({ ok: true, message: `Added ${advisoryCount} public advisory source(s), collected ${captureCount} capture(s), rebuilt ${savedAlertCount} alert(s), opened ${caseId || 'a case'}.${deliveryText}` })
            if (caseId) {
                router.push(caseDetailPath(caseId, alert.id, organizationId, 'source_pack'))
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
            setLastRoute({
                label: 'Source request',
                at: new Date().toISOString(),
                watchTerms: countTerms(terms),
                sourceCount: duplicateOf ? 0 : 1,
            })
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
            setLastRoute({
                label: 'Collection run',
                at: new Date().toISOString(),
                watchTerms: countTerms(workflowTerms(terms)),
                captureCount,
                alertCount: savedAlertCount,
            })
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
            setLastRoute({
                label: 'Telegram expansion',
                at: new Date().toISOString(),
                watchTerms: countTerms(nextTerms),
                sourceCount: createdCount,
                captureCount,
                alertCount: savedAlertCount,
            })
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
            const advisory = await enablePublicAdvisorySources(nextTerms, 24)
            if (!advisory.ok) throw new Error(advisory.message)
            const summary = approved.summary && typeof approved.summary === 'object' ? approved.summary as Record<string, unknown> : {}
            const count = typeof summary.darkwebMetadataCreated === 'number' ? summary.darkwebMetadataCreated : 0
            const advisorySummary = advisory.summary && typeof advisory.summary === 'object' ? advisory.summary as Record<string, unknown> : {}
            const advisoryCount = typeof advisorySummary.publicAdvisoryCreated === 'number' ? advisorySummary.publicAdvisoryCreated : 0
            setTerms(nextTerms)
            setResult({ ok: true, message: `Approved ${count} dark-web metadata source(s) and ${advisoryCount} public advisory source(s). No payload downloads enabled.` })
            setLastRoute({
                label: 'Metadata sources',
                at: new Date().toISOString(),
                watchTerms: countTerms(nextTerms),
                sourceCount: count + advisoryCount,
            })
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
            setLastRoute({
                label: 'Webhook delivery',
                at: new Date().toISOString(),
                watchTerms: effectiveTermCount,
                deliveryAttempts: attemptedCount,
                deliveryState: attemptedCount ? 'attempted' : 'nothing queued',
            })
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
            setResult({ ok: true, message: 'Webhook test delivered. Future alerts can use this destination.' })
            setLastRoute({
                label: 'Webhook test',
                at: new Date().toISOString(),
                watchTerms: effectiveTermCount,
                deliveryAttempts: 1,
                deliveryState: 'test delivered',
            })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    function focusWebhookInput() {
        webhookInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        webhookInputRef.current?.focus()
        setResult({ ok: true, message: 'Paste an HTTPS endpoint, then test the delivery destination.' })
    }

    function seedStarterWatchlist() {
        if (countTerms(terms)) return
        setTerms(starterWatchTerms())
        setResult({ ok: true, message: 'Starter watchlist prepared. Replace each line with real customer terms before saving or running to case.' })
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
    const watchlistDisabledReason = termCount ? '' : 'Add watchlist terms or prepare the starter list first.'
    const sourceDisabledReason = sourceReady ? '' : 'Add a public Telegram handle or t.me URL first.'
    const claimDisabledReason = claimReady ? '' : 'Add the actor name and affected company before ingesting evidence.'
    const webhookTestDisabledReason = webhookConfigured ? '' : 'Enter an HTTPS webhook URL before testing delivery.'
    const routeQueue = [
        {
            id: 'full_route',
            label: 'Run full workflow',
            state: !termCount ? 'watchlist needed' : alertCount ? `${alertCount} alerts ready` : captureCount ? `${captureCount} captures ready` : 'source pack ready',
            detail: 'Enable sources, collect captures, rebuild alerts, open a case, and dry-run delivery when a webhook is staged.',
            tone: alertCount ? 'ok' : captureCount ? 'warn' : 'neutral',
            command: 'Run to case',
            busy: busyAction === 'source-case',
            disabled: busy || Boolean(watchlistDisabledReason),
            disabledReason: watchlistDisabledReason,
            onClick: runSourcePackToCase,
        },
        {
            id: 'watchlist',
            label: 'Watchlist match',
            state: termCount ? `${termCount} terms` : 'terms needed',
            detail: termCount ? 'Save the customer terms and rebuild matching alerts from collected evidence.' : 'Prepare an editable starter list, then replace each line with customer-owned terms.',
            tone: effectiveTermCount ? 'ok' : 'warn',
            command: termCount ? 'Save and rebuild' : 'Prepare starter list',
            busy: busyAction === 'watchlist',
            disabled: busy,
            onClick: termCount ? saveAndRebuildWatchlist : seedStarterWatchlist,
        },
        {
            id: 'capture',
            label: 'Live capture',
            state: captureCount ? `${captureCount} captures` : latestRunStatus || 'not collected',
            detail: 'Run bounded public collection and add safe excerpts to the review lane.',
            tone: captureCount ? 'ok' : activeSourceCount ? 'warn' : 'neutral',
            command: 'Run collection',
            busy: busyAction === 'collection',
            disabled: busy,
            onClick: runCollection,
        },
        {
            id: 'delivery',
            label: 'Discord/webhook',
            state: deliveryCount ? `${deliveryCount} attempts` : webhookConfigured ? 'URL staged' : 'destination needed',
            detail: deliveryCount ? 'Review the delivery result before recording customer notification.' : 'Test the endpoint before sending customer findings.',
            tone: deliveryCount ? 'ok' : webhookConfigured ? 'warn' : 'bad',
            command: webhookConfigured ? 'Test webhook' : 'Add endpoint',
            busy: busyAction === 'webhook-test',
            disabled: busy,
            onClick: webhookConfigured ? testWebhook : focusWebhookInput,
        },
    ] satisfies RouteQueueAction[]

    return (
        <div data-dwm-workflow-runbook className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 text-ui-text sm:p-4'>
            <section className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.62fr)] lg:items-start'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Monitoring workflow</p>
                    <h2 className='mt-1 text-lg font-semibold tracking-normal text-ui-text'>Watchlist to case</h2>
                    <div className='mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5'>
                        <RouteStateCard label='Terms' value={String(effectiveTermCount)} detail={termCount ? 'ready' : 'needed'} tone={termCount ? 'ok' : 'warn'} />
                        <RouteStateCard label='Sources' value={`${activeSourceCount}/${sourceCount}`} detail={sourceCount ? 'active' : 'load pack'} tone={activeSourceCount ? 'ok' : 'warn'} />
                        <RouteStateCard label='Captures' value={String(captureCount)} detail={latestRunStatus ? `${latestRunStatus}${latestRunCaptureCount ? ` · ${latestRunCaptureCount}` : ''}` : 'idle'} tone={captureCount ? 'ok' : 'neutral'} />
                        <RouteStateCard label='Alerts' value={String(alertCount)} detail={`${telemetry?.watchlistMatchCount ?? 0} matches`} tone={alertCount ? 'ok' : termCount ? 'warn' : 'neutral'} />
                        <RouteStateCard label='Webhook' value={deliveryCount ? `${deliveryCount}` : webhookConfigured ? 'staged' : 'none'} detail={deliveryCount ? 'attempts' : webhookConfigured ? 'test' : 'add URL'} tone={deliveryCount || webhookConfigured ? 'ok' : 'warn'} />
                    </div>
                </div>
                {result ? (
                    <div data-dwm-workflow-result className={`rounded-lg border px-3 py-2 text-sm leading-5 ${result.ok ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'}`}>
                        <p className='font-semibold'>{result.ok ? 'Workflow updated' : 'Action blocked'}</p>
                        <p className='mt-1 text-xs leading-5'>{result.message}</p>
                    </div>
                ) : (
                    <div className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
                        <p className='text-[10px] font-semibold uppercase text-ui-subtle'>Workflow state</p>
                        <p className='mt-1 text-sm font-semibold text-ui-text'>{alertCount ? `${alertCount} alert${alertCount === 1 ? '' : 's'} ready` : termCount ? 'Ready to collect' : 'Add watchlist terms'}</p>
                        <p className='mt-1 text-xs leading-5 text-ui-muted'>{deliveryCount ? `${deliveryCount} delivery attempt${deliveryCount === 1 ? '' : 's'} recorded.` : 'Stage a webhook when the case needs customer notification.'}</p>
                    </div>
                )}
            </section>

            <section data-dwm-route-queue className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='min-w-0'>
                        <h3 className='text-sm font-semibold text-ui-text'>Commands</h3>
                        <p className='mt-0.5 text-xs leading-5 text-ui-subtle'>Every command calls the DWM API and refreshes the queue.</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        {organizationId ? (
                            <Link href={`/organizations?organizationId=${encodeURIComponent(organizationId)}&focus=watchlists`} className='inline-flex min-h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>
                                Org watchlists
                            </Link>
                        ) : null}
                        <Link href='/dashboard/ti/workbench' className='inline-flex min-h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>
                            Alert review
                        </Link>
                    </div>
                </div>
                <div className='mt-3 grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-4'>
                    {routeQueue.map(action => <RouteQueueCard key={action.id} action={action} />)}
                </div>
                <div data-dwm-inline-webhook className='mt-3 grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end'>
                    <label className='min-w-0'>
                        <span className='text-[10px] font-semibold uppercase text-ui-subtle'>Delivery endpoint</span>
                        <input
                            ref={webhookInputRef}
                            value={webhookUrl}
                            onChange={event => setWebhookUrl(event.target.value)}
                            placeholder='https://discord.com/api/webhooks/...'
                            className='mt-1 h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                        />
                    </label>
                    <WorkflowButton busy={busyAction === 'webhook-test'} disabled={busy || Boolean(webhookTestDisabledReason)} disabledReason={webhookTestDisabledReason || undefined} icon={<Send className='h-4 w-4' />} onClick={testWebhook}>Test destination</WorkflowButton>
                    <WorkflowButton busy={busyAction === 'delivery'} disabled={busy} icon={<Send className='h-4 w-4' />} onClick={deliverWebhooks}>Send queued</WorkflowButton>
                    <p className='text-xs leading-5 text-ui-subtle lg:col-span-3'>
                        {webhookConfigured ? 'Delivery actions use the staged endpoint for dry-runs and queued alert sends.' : 'Paste an HTTPS Discord or webhook endpoint before testing customer delivery.'}
                    </p>
                </div>
                {lastRoute ? <RouteRunSummary route={lastRoute} /> : null}
            </section>

            <div className='grid gap-4 xl:grid-cols-2 2xl:grid-cols-[1.05fr_0.95fr_0.95fr]'>
                <form onSubmit={saveWatchlist} className='rounded-lg border border-ui-border bg-ui-raised p-4 shadow-sm'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Customer watchlist</h2>
                            <p className='mt-1 text-xs leading-5 text-ui-subtle'>Company, domain, vendor, brand, and product terms.</p>
                        </div>
                        <BellRing className='h-5 w-5 text-ui-primary' />
                    </div>
                    <textarea
                        value={terms}
                        onChange={event => setTerms(event.target.value)}
                        placeholder={'your-company.com\nPrimary supplier\nCustomer brand'}
                        className='mt-3 min-h-28 w-full resize-y rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <button disabled={busy || Boolean(watchlistDisabledReason)} title={watchlistDisabledReason || undefined} className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'>
                            {busyAction === 'watchlist' ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                            Save and rebuild alerts
                        </button>
                        <WorkflowButton busy={busyAction === 'collection'} disabled={busy} icon={<RefreshCw className='h-4 w-4' />} onClick={runCollection}>Run Telegram collection</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'telegram-pack'} disabled={busy} icon={<Plus className='h-4 w-4' />} onClick={expandTelegramCoverage}>Expand Telegram</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'darkweb'} disabled={busy} icon={<ShieldCheck className='h-4 w-4' />} onClick={approveDarkwebMetadata}>Approve metadata</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'source-case'} disabled={busy || Boolean(watchlistDisabledReason)} disabledReason={watchlistDisabledReason || undefined} icon={<ShieldCheck className='h-4 w-4' />} onClick={runSourcePackToCase}>Run to case</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'delivery'} disabled={busy} icon={<Send className='h-4 w-4' />} onClick={deliverWebhooks}>Send webhooks</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'webhook-test'} disabled={busy || Boolean(webhookTestDisabledReason)} disabledReason={webhookTestDisabledReason} icon={<Send className='h-4 w-4' />} onClick={testWebhook}>Test webhook</WorkflowButton>
                        {starterTermsActive ? <WorkflowButton busy={false} disabled={busy} icon={<Plus className='h-4 w-4' />} onClick={seedStarterWatchlist}>Prepare starter list</WorkflowButton> : null}
                    </div>
                    {starterTermsActive ? <p className='mt-2 text-xs leading-5 text-ui-warning'>No saved terms yet. Prepare a starter list or paste customer-owned company, domain, supplier, brand, or product terms.</p> : null}
                    {webhookTestDisabledReason ? <p className='mt-1 text-xs leading-5 text-ui-subtle'>{webhookTestDisabledReason}</p> : null}
                </form>

                <form onSubmit={ingestMetadataClaim} className='rounded-lg border border-ui-border bg-ui-raised p-4 shadow-sm'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Exposure intake</h2>
                            <p className='mt-1 text-sm leading-6 text-ui-subtle'>Create a metadata-only capture, add the affected company to the watchlist, and rebuild alerts.</p>
                        </div>
                        <ShieldCheck className='h-5 w-5 text-ui-primary' />
                    </div>
                    <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                        <input
                            value={claimActor}
                            onChange={event => setClaimActor(event.target.value)}
                            placeholder='Actor'
                            className='h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                        />
                        <input
                            value={claimCompany}
                            onChange={event => setClaimCompany(event.target.value)}
                            placeholder='Affected company or domain'
                            className='h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                        />
                    </div>
                    <input
                        value={claimData}
                        onChange={event => setClaimData(event.target.value)}
                        placeholder='Exposure details, sector, or access type'
                        className='mt-3 h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <input
                        value={claimUrl}
                        onChange={event => setClaimUrl(event.target.value)}
                        placeholder='Source URL, optional'
                        className='mt-3 h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
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
                    {claimDisabledReason ? <p className='mt-2 text-xs leading-5 text-ui-subtle'>{claimDisabledReason}</p> : null}
                </form>

                <form onSubmit={submitSource} className='rounded-lg border border-ui-border bg-ui-raised p-4 shadow-sm'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Telegram source request</h2>
                            <p className='mt-1 text-sm leading-6 text-ui-subtle'>Add a public @handle or t.me URL. Private invites stay out of automated collection.</p>
                        </div>
                        <Plus className='h-5 w-5 text-ui-primary' />
                    </div>
                    <input
                        value={sourceTarget}
                        onChange={event => setSourceTarget(event.target.value)}
                        placeholder='@breach_drop_house or https://t.me/channel'
                        className='mt-4 h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <button disabled={busy || Boolean(sourceDisabledReason)} title={sourceDisabledReason || undefined} className='mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'>
                        {busyAction === 'source' ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                        Submit source
                    </button>
                    {sourceDisabledReason ? <p className='mt-2 text-xs leading-5 text-ui-subtle'>{sourceDisabledReason}</p> : null}
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

function caseDetailPath(caseId: string, alertId: string, organizationId?: string, route?: string) {
    const params = new URLSearchParams()
    if (organizationId) params.set('organizationId', organizationId)
    params.set('alertId', alertId)
    if (route) params.set('route', route)
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

type RouteQueueAction = {
    id: string
    label: string
    state: string
    detail: string
    tone: 'ok' | 'warn' | 'bad' | 'neutral'
    command: string
    busy: boolean
    disabled: boolean
    disabledReason?: string
    onClick: () => void | Promise<void>
}

function RouteQueueCard({ action }: { action: RouteQueueAction }) {
    const toneClass = action.tone === 'ok'
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : action.tone === 'warn'
            ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
            : action.tone === 'bad'
                ? 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
                : 'border-ui-border bg-ui-panel text-ui-muted'
    return (
        <article className='grid min-h-36 min-w-0 gap-3 rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='min-w-0'>
                <div className='flex items-start justify-between gap-2'>
                    <h4 className='min-w-0 wrap-break-word text-sm font-semibold text-ui-text'>{action.label}</h4>
                    <span className={`max-w-[55%] shrink-0 truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`} title={action.state}>{action.state}</span>
                </div>
                <p className='mt-2 line-clamp-2 text-xs leading-5 text-ui-subtle'>{action.detail}</p>
            </div>
            <button
                type='button'
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.disabledReason}
                className='mt-auto inline-flex min-h-9 max-w-full items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/30 disabled:cursor-not-allowed disabled:opacity-60'
            >
                {action.busy ? <Loader2 className='h-4 w-4 animate-spin' /> : <Activity className='h-4 w-4' />}
                {action.busy ? 'Running...' : action.command}
            </button>
        </article>
    )
}

function RouteRunSummary({ route }: { route: WorkflowRouteSummary }) {
    const cells = [
        { label: 'Watch terms', value: String(route.watchTerms) },
        { label: 'Sources', value: route.sourceCount === undefined ? 'unchanged' : String(route.sourceCount) },
        { label: 'Captures', value: route.captureCount === undefined ? 'pending' : String(route.captureCount) },
        { label: 'Alerts', value: route.alertCount === undefined ? 'pending' : String(route.alertCount) },
        { label: 'Case', value: route.caseId || 'not opened' },
        { label: 'Delivery', value: route.deliveryAttempts === undefined ? route.deliveryState || 'not run' : `${route.deliveryAttempts} attempt${route.deliveryAttempts === 1 ? '' : 's'}` },
    ]
    return (
        <section data-dwm-route-run-summary className='mt-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Last workflow run</p>
                    <h4 className='mt-1 text-sm font-semibold text-ui-text'>{route.label} · {relativeTime(route.at)}</h4>
                </div>
                <div className='flex flex-wrap gap-2'>
                    {route.caseHref ? (
                        <Link href={route.caseHref} className='inline-flex h-8 items-center rounded-lg border border-ui-primary bg-ui-primary/10 px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-primary/15 focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>
                            Open case
                        </Link>
                    ) : null}
                    {route.alertId ? <span className='inline-flex h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-3 font-mono text-[11px] text-ui-muted'>{route.alertId}</span> : null}
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6'>
                {cells.map(cell => (
                    <div key={cell.label} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>
                        <p className='text-[10px] font-semibold uppercase text-ui-subtle'>{cell.label}</p>
                        <p className='mt-1 truncate text-sm font-semibold text-ui-text' title={cell.value}>{cell.value}</p>
                    </div>
                ))}
            </div>
            {route.deliveryState ? <p className='mt-2 text-xs leading-5 text-ui-subtle'>{route.deliveryState}</p> : null}
        </section>
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
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
            <div className='flex items-center justify-between gap-2 text-ui-subtle'>
                <p className='truncate text-[10px] font-semibold uppercase'>{label}</p>
                <Activity className='h-3.5 w-3.5 shrink-0' />
            </div>
            <p className={`mt-1 truncate text-base font-semibold ${toneClass}`}>{value}</p>
            <p className='truncate text-[11px] leading-4 text-ui-subtle'>{detail}</p>
        </div>
    )
}

function WorkflowButton({ busy, disabled, disabledReason, icon, onClick, children }: { busy: boolean, disabled: boolean, disabledReason?: string, icon: React.ReactNode, onClick: () => void, children: string }) {
    return (
        <button type='button' onClick={onClick} disabled={disabled} title={disabledReason || undefined} className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60'>
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
    return value.split(/[\n,]/).map(term => term.trim()).filter(Boolean).join('\n')
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

function readSummaryNumber(value: Record<string, unknown>, key: string) {
    const summary = value.summary
    if (!summary || typeof summary !== 'object') return 0
    const candidate = (summary as Record<string, unknown>)[key]
    return typeof candidate === 'number' ? candidate : 0
}

function relativeTime(value: string) {
    const then = new Date(value).getTime()
    if (!Number.isFinite(then)) return 'just now'
    const delta = Date.now() - then
    const abs = Math.abs(delta)
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (abs < minute) return 'just now'
    if (abs < hour) return `${Math.max(1, Math.round(abs / minute))}m ago`
    if (abs < day) return `${Math.round(abs / hour)}h ago`
    return `${Math.round(abs / day)}d ago`
}
