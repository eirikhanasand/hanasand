'use client'

import Link from 'next/link'
import BrowserDebug from '../BrowserDebug'
import { hasSuspiciousFindings, reportMarkdown } from './presentation'
import { useEffect, useMemo, useState } from 'react'

type NetworkRequestRow = { url?: string; method?: string; status?: number; failure?: string; host?: string; mimeType?: string; durationMs?: number; initiator?: string; ip?: string; asn?: string; port?: number; protocol?: string; tlsSubject?: string; tlsIssuer?: string; tlsValidFrom?: number; tlsValidTo?: number }

type BrowserReport = {
    runId?: string
    runs?: Array<{ id: string; startedAt: string; status: string }>
    target?: string
    finalUrl?: string
    exportedAt?: string
    consoleEvents?: string[]
    providerConsoleEvents?: string[]
    status?: { run?: string; connection?: string; capacity?: { activeSessions?: number; maxSessions?: number; queuedSessions?: number; queuePosition?: number } }
    captures?: Array<{
        kind?: string
        label?: string
        url?: string
        title?: string
        capturedAt?: string
        reason?: string
        image?: string | null
        frameQuality?: { looksBlank?: boolean; visibleTextLength?: number; elementCount?: number }
        evidence?: { verdict?: string; sourceUrls?: string[]; textExcerpt?: string; sourceCode?: string }
    }>
    analystSummary?: {
        narrative?: string
        indicators?: string[]
        threatAssociations?: Array<{ name?: string; category?: string; confidence?: string; evidence?: string; source?: string }>
        urlTimeline?: Array<{ url?: string; capturedAt?: string; reason?: string; title?: string }>
    }
    analystReport?: {
        verdict?: string
        evidenceChecklist?: Record<string, number>
        providerReports?: Array<{ tool?: string; status?: string; verdict?: string; url?: string; vendorFlagged?: number; vendorTotal?: number; alertCount?: number; communityCommentCount?: number; communityComments?: string[]; communitySummary?: string; screenshotCaptured?: boolean; deobfuscatedCode?: string; signals?: string[]; threatAssociations?: Array<{ name?: string; confidence?: string; source?: string }>; error?: string }>
        networkEvidence?: {
            requests?: number
            responses?: number
            blockedOrFailed?: number
            contactedDomains?: string[]
            finalUrl?: string
            redirectChain?: string[]
            urlStates?: string[]
            peerSummary?: NetworkRequestRow[]
            downloads?: Array<{ url?: string; fileName?: string; bytes?: number; sha256?: string; hashStatus?: string; virusTotal?: { status?: string; flagged?: number; total?: number; detail?: string } }>
            recentRequests?: NetworkRequestRow[]
        }
        scriptArtifacts?: Array<{ scriptId?: string; source?: string; sha256?: string; assessment?: string; summary?: string; indicators?: { domains?: string[]; ips?: string[]; urls?: string[] } }>
        resourceUrls?: string[]
        urlTimeline?: Array<{ url?: string; capturedAt?: string; reason?: string; title?: string }>
        indicators?: string[]
        threatAssociations?: Array<{ name?: string; category?: string; confidence?: string; evidence?: string; source?: string }>
        recommendedActions?: string[]
        markdown?: string
    }
}

export default function BrowserReportPageClient({ runId = '', token = '', resultId, clientId, onRerun, initialRun = '' }: { initialRun?: string; runId?: string; token?: string; resultId?: string; clientId?: string; onRerun?: (target: string, quick?: boolean) => void }) {
    const [report, setReport] = useState<BrowserReport | null>(null)
    const [error, setError] = useState('')
    const [selectedRun, setSelectedRun] = useState(initialRun)
    const endpoint = useMemo(() => resultId
        ? clientId ? `/api/backend/browser/results/${encodeURIComponent(resultId)}?clientId=${encodeURIComponent(clientId)}${selectedRun ? `&run=${encodeURIComponent(selectedRun)}` : ''}` : ''
        : runId && token ? `/api/backend/browser/runs/${encodeURIComponent(runId)}/report?token=${encodeURIComponent(token)}` : '', [runId, token, resultId, clientId, selectedRun])

    useEffect(() => {
        if (!endpoint) {
            if (resultId) return
            setError('Missing report token.')
            return
        }
        const controller = new AbortController()
        setError('')
        setReport(null)
        fetch(endpoint, { cache: 'no-store', credentials: 'include', signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error('Report not found.')
                return await response.json() as BrowserReport
            })
            .then(setReport)
            .catch(error => { if (error.name !== 'AbortError') setError(error instanceof Error ? error.message : 'Failed to load report.') })
        return () => controller.abort()
    }, [endpoint, resultId])

    if (error) {
        return <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas p-6 text-ui-text'><div className='mx-auto max-w-3xl rounded-lg border border-ui-border bg-ui-panel p-6'>{error}</div></main>
    }

    if (!report) {
        return <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas p-6 text-ui-muted'><div className='mx-auto max-w-3xl rounded-lg border border-ui-border bg-ui-panel p-6'>Loading browser report...</div></main>
    }

    const analystReport = report.analystReport || {}
    const summary = report.analystSummary || {}
    const suspicious = hasSuspiciousFindings(report)
    const actions = suspicious ? analystReport.recommendedActions || [] : []

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-6 text-ui-text'>
            <section className='mx-auto grid max-w-6xl gap-4'>
                <header className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <Link href='/browser' className='text-sm text-ui-primary'>Browser</Link>
                        {onRerun && report.target ? <div className='flex gap-2'><button type='button' onClick={() => onRerun(report.target!, true)} className='rounded-md border border-ui-border px-3 py-2 text-sm font-semibold hover:border-ui-primary'>Quick run</button><button type='button' onClick={() => onRerun(report.target!)} className='rounded-md border border-ui-border px-3 py-2 text-sm font-semibold hover:border-ui-primary'>Run again</button></div> : null}
                    </div>
                    {report.runs && report.runs.length > 1 ? <label className='mt-3 flex flex-wrap items-center gap-2 text-sm'>Run<select aria-label='Saved run' className='rounded-md border border-ui-border bg-ui-canvas p-2' value={report.runId} onChange={event => setSelectedRun(event.target.value)}>{report.runs.map(run => <option key={run.id} value={run.id}>{new Date(run.startedAt).toLocaleString()} · {run.status}</option>)}</select></label> : null}
                    <h1 className='mt-2 break-all text-2xl font-semibold'>{report.target || 'Saved browser run'}</h1>
                    <p className='mt-2 break-all font-mono text-xs text-ui-muted'>Final URL: {report.finalUrl || report.target || 'unknown'}</p>
                    <div className='mt-3 flex flex-wrap gap-2 text-xs'>
                        <span className='rounded border border-ui-border bg-ui-raised px-2 py-1'>{/^Review required/i.test(analystReport.verdict || '') ? suspicious ? 'Suspicious activity observed' : 'No signs of suspicious activity.' : analystReport.verdict || 'Verdict unavailable'}</span>
                        {report.status?.run ? <span className='rounded border border-ui-border bg-ui-raised px-2 py-1'>Run {report.status.run}</span> : null}
                        {report.status?.connection ? <span className='rounded border border-ui-border bg-ui-raised px-2 py-1'>Connection {report.status.connection}</span> : null}
                        {report.status?.capacity ? <span className='rounded border border-ui-border bg-ui-raised px-2 py-1'>Capacity {report.status.capacity.activeSessions || 0}/{report.status.capacity.maxSessions || '?'}{report.status.capacity.queuePosition ? ` · queue #${report.status.capacity.queuePosition}` : ''}</span> : null}
                        {report.exportedAt ? <span className='rounded border border-ui-border bg-ui-raised px-2 py-1'>Exported {report.exportedAt}</span> : null}
                    </div>
                </header>

                <section className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'>
                    <div className='grid gap-4'>
                        <ReportPanel title='Summary'>
                            <p className='text-sm leading-6 text-ui-muted'>{summary.narrative || 'No analyst summary was saved with this report.'}</p>
                        </ReportPanel>
                        <ReportPanel title='URL timeline'>
                            <ReportList items={reportUrlTimeline(report).map(item => [
                                item.capturedAt || '',
                                item.reason || 'capture',
                                item.url || '',
                                item.title || '',
                            ].filter(Boolean).join(' · '))} empty='No URL timeline saved.' />
                        </ReportPanel>
                        <ReportPanel title='Providers'>
                            <div className='grid gap-2'>
                                {(analystReport.providerReports || []).filter(provider => !/webcrack/i.test(provider.tool || '') || provider.deobfuscatedCode || provider.status === 'Provider error').map(provider => provider.deobfuscatedCode ? (
                                    <div key={`${provider.tool}-${provider.url}`}><h2 className='mb-2 text-sm font-semibold'>{provider.tool}</h2><pre className='max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md border border-ui-border bg-ui-canvas p-3 font-mono text-xs'>{provider.deobfuscatedCode}</pre></div>
                                ) : (
                                    <div key={`${provider.tool}-${provider.url}`} className='rounded-md border border-ui-border bg-ui-raised p-3 text-sm'>
                                        <p className='font-semibold'>{provider.tool || 'Provider'} · {provider.status || 'unknown'}</p>
                                        <p className='mt-1 text-xs text-ui-muted'>{provider.verdict || 'No parsed verdict'}{provider.vendorFlagged !== undefined ? ` · ${providerVendorLabel(provider)} vendors` : ''}{provider.alertCount !== undefined ? ` · ${provider.alertCount} alerts` : ''}{provider.screenshotCaptured ? ' · screenshot captured' : ''}</p>
                                        {provider.url ? <a href={provider.url} target='_blank' rel='noreferrer noopener' className='mt-1 block truncate font-mono text-xs text-ui-primary underline-offset-2 hover:underline'>{provider.url}</a> : null}
                                        {provider.error ? <p className='mt-2 text-xs text-ui-danger'>{provider.error}</p> : null}
                                        {provider.communityComments?.length ? <div className='mt-2 grid gap-1'>{provider.communityComments.map((comment, index) => <blockquote key={`${index}-${comment}`} className='rounded-md border border-ui-border bg-ui-canvas px-2 py-1.5 text-xs leading-5'>{comment}</blockquote>)}</div> : null}
                                        {!provider.communityComments?.length && provider.communitySummary ? <p className='mt-2 text-xs leading-5 text-ui-muted'>Provider summary: {provider.communitySummary}</p> : null}
                                        {provider.threatAssociations?.length ? <p className='mt-2 text-xs text-ui-warning'>{provider.threatAssociations.slice(0, 4).map(item => [item.name, item.confidence ? `${item.confidence} confidence` : '', item.source].filter(Boolean).join(' · ')).join('\n')}</p> : null}
                                        {provider.signals?.length ? <pre className='mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-ui-border bg-ui-canvas p-2 font-mono text-xs text-ui-text'>{provider.signals.slice(0, 12).join('\n')}</pre> : null}
                                    </div>
                                ))}
                            </div>
                        </ReportPanel>
                        <ReportPanel title='Screenshots'>
                            <div className='grid gap-3 sm:grid-cols-2'>
                                {(report.captures || []).filter(capture => capture.image).map(capture => (
                                    <article key={`${capture.kind}-${capture.capturedAt}-${capture.url}`} className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-3'>
                                        <div className='min-w-0'>
                                            <p className='text-sm font-semibold'>{capture.reason === 'domcontentloaded' ? 'Screenshot' : capture.label || capture.kind || 'Screenshot'}</p>
                                            <p className='truncate font-mono text-xs text-ui-muted'>{capture.url || capture.title || ''}</p>
                                        </div>
                                        {capture.image ? <img src={capture.image} alt={`${capture.label || 'Browser'} screenshot`} className='max-h-64 w-full rounded border border-ui-border object-contain' /> : null}
                                        {capture.frameQuality ? <p className={`text-xs font-semibold ${capture.frameQuality.looksBlank ? 'text-ui-danger' : 'text-ui-success'}`}>{capture.frameQuality.looksBlank ? 'Blank-looking frame' : 'Rendered frame'} · {capture.frameQuality.visibleTextLength || 0} chars · {capture.frameQuality.elementCount || 0} elements</p> : null}
                                        {capture.evidence?.textExcerpt ? <details><summary className='cursor-pointer text-xs'>Page text</summary><pre className='mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs'>{capture.evidence.textExcerpt}</pre></details> : null}
                                        {capture.evidence?.sourceCode ? <details><summary className='cursor-pointer text-xs'>Source code</summary><pre className='mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs'>{capture.evidence.sourceCode}</pre></details> : null}
                                        <p className='text-xs text-ui-muted'>{capture.capturedAt || ''}{capture.reason ? ` · ${capture.reason}` : ''}</p>
                                    </article>
                                ))}
                            </div>
                            {!(report.captures || []).some(capture => capture.image) ? <p className='text-sm text-ui-muted'>No screenshots saved.</p> : null}
                        </ReportPanel>
                        <ReportPanel title='Network evidence'>
                            <ReportList items={[
                                `${analystReport.networkEvidence?.requests || 0} requests`,
                                `${analystReport.networkEvidence?.responses || 0} responses`,
                                `${analystReport.networkEvidence?.blockedOrFailed || 0} blocked/failed`,
                                `final URL: ${analystReport.networkEvidence?.finalUrl || report.finalUrl || report.target || 'unknown'}`,
                                ...((analystReport.networkEvidence?.urlStates || []).map(url => `URL state: ${url}`)),
                                ...((analystReport.networkEvidence?.redirectChain || []).map(url => `redirect: ${url}`)),
                            ]} empty='No network evidence saved.' />
                            {analystReport.networkEvidence?.peerSummary?.length ? (
                                <>
                                    <p className='mt-3 text-xs font-semibold uppercase text-ui-muted'>DNS / IP / certificate evidence</p>
                                    <ReportList items={analystReport.networkEvidence.peerSummary.map(peer => [
                                        peer.host || peer.url || 'peer',
                                        peer.ip ? `${peer.ip}${peer.port ? `:${peer.port}` : ''}` : '',
                                        peer.asn ? `AS${peer.asn}` : '',
                                        peer.protocol || '',
                                        peer.tlsSubject ? `cert ${peer.tlsSubject}` : '',
                                        peer.tlsIssuer || '',
                                        peer.tlsValidTo ? `expires ${formatEpochDate(peer.tlsValidTo)}` : '',
                                    ].filter(Boolean).join(' · '))} empty='No peer evidence saved.' />
                                </>
                            ) : null}
                            {analystReport.networkEvidence?.recentRequests?.length ? (
                                <div className='mt-3 max-h-96 overflow-auto rounded-md border border-ui-border'>
                                    <table className='w-full min-w-[56rem] border-collapse text-left text-xs'>
                                        <thead className='sticky top-0 bg-ui-raised text-ui-muted'>
                                            <tr>
                                                <th className='border-b border-ui-border px-2 py-1'>Method</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Status</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Host</th>
                                                <th className='border-b border-ui-border px-2 py-1'>MIME</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Peer</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Time</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Initiator</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Block reason</th>
                                                <th className='border-b border-ui-border px-2 py-1'>URL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {analystReport.networkEvidence.recentRequests.slice(-40).map((request, index) => (
                                                <tr key={`${request.url}-${request.status}-${request.failure}-${index}`}>
                                                    <td className='border-b border-ui-border/60 px-2 py-1'>{request.method || 'GET'}</td>
                                                    <td className='border-b border-ui-border/60 px-2 py-1'>{request.status || request.failure || ''}</td>
                                                    <td className='max-w-36 truncate border-b border-ui-border/60 px-2 py-1 font-mono'>{request.host || ''}</td>
                                                    <td className='max-w-40 truncate border-b border-ui-border/60 px-2 py-1'>{request.mimeType || ''}</td>
                                                    <td className='max-w-64 truncate border-b border-ui-border/60 px-2 py-1 font-mono text-ui-muted'>{networkPeer(request)}</td>
                                                    <td className='border-b border-ui-border/60 px-2 py-1'>{request.durationMs !== undefined ? `${request.durationMs}ms` : ''}</td>
                                                    <td className='max-w-48 truncate border-b border-ui-border/60 px-2 py-1 font-mono text-ui-muted'>{request.initiator || ''}</td>
                                                    <td className='max-w-48 truncate border-b border-ui-border/60 px-2 py-1 text-ui-danger'>{request.failure || ''}</td>
                                                    <td className='max-w-[28rem] truncate border-b border-ui-border/60 px-2 py-1 font-mono text-ui-text'>{request.url || ''}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                            {analystReport.networkEvidence?.contactedDomains?.length ? (
                                <>
                                    <p className='mt-3 text-xs font-semibold uppercase text-ui-muted'>Contacted domains</p>
                                    <pre className='mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-ui-border bg-ui-canvas p-3 text-xs text-ui-text'>{analystReport.networkEvidence.contactedDomains.join('\n')}</pre>
                                </>
                            ) : null}
                            {analystReport.networkEvidence?.downloads?.length ? (
                                <pre className='mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-ui-border bg-ui-canvas p-3 text-xs text-ui-text'>{analystReport.networkEvidence.downloads.map(download => [
                                    download.fileName || download.url || 'download',
                                    download.bytes !== undefined ? `${download.bytes} bytes` : '',
                                    download.sha256 ? `sha256 ${download.sha256}` : download.hashStatus || '',
                                    download.virusTotal?.total ? `VirusTotal: ${download.virusTotal.flagged || 0}/${download.virusTotal.total} detections` : download.virusTotal?.detail || download.virusTotal?.status || '',
                                    download.url && download.fileName ? download.url : '',
                                ].filter(Boolean).join('\n')).join('\n\n')}</pre>
                            ) : null}
                        </ReportPanel>
                        <ReportPanel title='Console logs'>
                            <pre className='max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-ui-muted'>{report.consoleEvents?.join('\n') || 'No console output saved from the inspected page.'}</pre>
                        </ReportPanel>

                        <ReportPanel title='Script artifacts'>
                            <ReportList items={(analystReport.scriptArtifacts || []).map(script => [
                                script.assessment || 'script',
                                script.scriptId || script.source || 'sample',
                                script.sha256 ? `sha256 ${script.sha256}` : '',
                                script.summary || '',
                                ...scriptIndicatorList(script).slice(0, 6),
                            ].filter(Boolean).join(' · '))} empty='No script artifacts saved.' />
                        </ReportPanel>
                        <ReportPanel title='URLs'>
                            <ReportList items={reportResourceUrls(report).slice(0, 80)} empty='No URLs saved.' />
                        </ReportPanel>
                        <ReportPanel title='Markdown export'>
                            <pre className='max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md border border-ui-border bg-ui-canvas p-3 text-xs text-ui-text'>{reportMarkdown(analystReport.markdown || '', suspicious) || 'No markdown export saved.'}</pre>
                        </ReportPanel>
                    </div>
                    <aside className='grid content-start gap-4'>
                        <ReportPanel title='Evidence checklist'>
                            <ReportList items={Object.entries(analystReport.evidenceChecklist || {}).map(([key, value]) => `${key}: ${value}`)} empty='No checklist saved.' />
                        </ReportPanel>
                        {actions.length ? <ReportPanel title='Actions'>
                            <ReportList items={actions} empty='' />
                        </ReportPanel> : null}
                        <ReportPanel title='Threat context'>
                            <ReportList items={reportThreatAssociations(report).map(item => [
                                item.name || 'Threat association',
                                item.category || 'context',
                                item.confidence ? `${item.confidence} confidence` : '',
                                item.source ? item.source.replace(/_/g, ' ') : '',
                                item.evidence || '',
                            ].filter(Boolean).join(' · '))} empty='No threat context saved.' />
                        </ReportPanel>
                        {reportIndicators(report).length > 0 ? <ReportPanel title='Indicators'>
                            <pre className='max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-ui-border bg-ui-canvas p-3 text-xs text-ui-text'>{reportIndicators(report).join('\n')}</pre>
                        </ReportPanel> : null}
                    </aside>
                </section>
                <BrowserDebug className='mt-4' indicatorCount={reportIndicators(report).length} logs={report.providerConsoleEvents} />
            </section>
        </main>
    )
}

function providerVendorLabel(provider: { vendorFlagged?: number; vendorTotal?: number }) {
    const flagged = provider.vendorFlagged ?? 0
    return provider.vendorTotal ? `${flagged}/${provider.vendorTotal}` : `${flagged} flagged`
}

function networkPeer(request: NetworkRequestRow) {
    return [
        request.ip ? `${request.ip}${request.port ? `:${request.port}` : ''}` : '',
        request.asn ? `AS${request.asn}` : '',
        request.protocol || '',
        request.tlsSubject ? `cert ${request.tlsSubject}` : '',
        request.tlsIssuer || '',
        request.tlsValidTo ? `expires ${formatEpochDate(request.tlsValidTo)}` : '',
    ].filter(Boolean).join(' · ')
}

function formatEpochDate(value: number) {
    return new Date(value * 1000).toISOString().slice(0, 10)
}

function reportUrlTimeline(report: BrowserReport) {
    return report.analystReport?.urlTimeline?.length ? report.analystReport.urlTimeline : report.analystSummary?.urlTimeline || []
}

function reportResourceUrls(report: BrowserReport) {
    return Array.from(new Set([...(report.analystReport?.resourceUrls || []), ...(report.captures || []).flatMap(capture => capture.evidence?.sourceUrls || [])])).filter(Boolean)
}

function reportIndicators(report: BrowserReport) {
    return Array.from(new Set([...(report.analystReport?.indicators || []), ...(report.analystSummary?.indicators || [])])).filter(Boolean)
}

function reportThreatAssociations(report: BrowserReport) {
    return report.analystReport?.threatAssociations?.length ? report.analystReport.threatAssociations : report.analystSummary?.threatAssociations || []
}



function scriptIndicatorList(script: NonNullable<NonNullable<BrowserReport['analystReport']>['scriptArtifacts']>[number]) {
    return [...(script.indicators?.domains || []), ...(script.indicators?.ips || []), ...(script.indicators?.urls || [])]
}

function ReportPanel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <details className='min-w-0 rounded-lg border border-ui-border bg-ui-panel'>
            <summary className='cursor-pointer p-4 text-sm font-semibold text-ui-primary'>{title}</summary>
            <div className='border-t border-ui-border p-4'>{children}</div>
        </details>
    )
}

function ReportList({ items, empty }: { items: string[]; empty: string }) {
    const rows = items.map(item => item.trim()).filter(Boolean)
    if (!rows.length) return <p className='text-sm text-ui-muted'>{empty}</p>
    return <ul className='grid gap-2 text-sm text-ui-muted'>{rows.map(item => <li key={item} className='rounded-md border border-ui-border bg-ui-raised px-3 py-2'>{item}</li>)}</ul>
}
