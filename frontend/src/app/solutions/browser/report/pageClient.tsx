'use client'

import { useEffect, useMemo, useState } from 'react'

type BrowserReport = {
    target?: string
    finalUrl?: string
    exportedAt?: string
    analystSummary?: {
        narrative?: string
        indicators?: string[]
        threatAssociations?: Array<{ name?: string; category?: string; confidence?: string; evidence?: string }>
        reviewQueue?: Array<{ severity?: string; source?: string; title?: string; detail?: string; evidence?: string }>
    }
    analystReport?: {
        verdict?: string
        evidenceChecklist?: Record<string, number>
        providerReports?: Array<{ tool?: string; status?: string; verdict?: string; url?: string; vendorFlagged?: number; vendorTotal?: number; alertCount?: number; communityCommentCount?: number }>
        networkEvidence?: { requests?: number; responses?: number; blockedOrFailed?: number; contactedDomains?: string[]; redirectChain?: string[] }
        scriptArtifacts?: Array<{ scriptId?: string; source?: string; sha256?: string; assessment?: string; summary?: string }>
        recommendedActions?: string[]
    }
}

export default function BrowserReportPageClient({ runId, token }: { runId: string; token: string }) {
    const [report, setReport] = useState<BrowserReport | null>(null)
    const [error, setError] = useState('')
    const endpoint = useMemo(() => runId && token ? `/api/backend/browser/runs/${encodeURIComponent(runId)}/report?token=${encodeURIComponent(token)}` : '', [runId, token])

    useEffect(() => {
        if (!endpoint) {
            setError('Missing report token.')
            return
        }
        fetch(endpoint, { cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Report not found.')
                return await response.json() as BrowserReport
            })
            .then(setReport)
            .catch(error => setError(error instanceof Error ? error.message : 'Failed to load report.'))
    }, [endpoint])

    if (error) {
        return <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas p-6 text-ui-text'><div className='mx-auto max-w-3xl rounded-lg border border-ui-border bg-ui-panel p-6'>{error}</div></main>
    }

    if (!report) {
        return <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas p-6 text-ui-muted'><div className='mx-auto max-w-3xl rounded-lg border border-ui-border bg-ui-panel p-6'>Loading browser report...</div></main>
    }

    const analystReport = report.analystReport || {}
    const summary = report.analystSummary || {}

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-6 text-ui-text'>
            <section className='mx-auto grid max-w-6xl gap-4'>
                <header className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>Browser sandbox report</p>
                    <h1 className='mt-2 break-all text-2xl font-semibold'>{report.target || 'Saved browser run'}</h1>
                    <p className='mt-2 break-all font-mono text-xs text-ui-muted'>Final URL: {report.finalUrl || report.target || 'unknown'}</p>
                    <div className='mt-3 flex flex-wrap gap-2 text-xs'>
                        <span className='rounded border border-ui-border bg-ui-raised px-2 py-1'>{analystReport.verdict || 'Verdict unavailable'}</span>
                        {report.exportedAt ? <span className='rounded border border-ui-border bg-ui-raised px-2 py-1'>Exported {report.exportedAt}</span> : null}
                    </div>
                </header>

                <section className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'>
                    <div className='grid gap-4'>
                        <ReportPanel title='Analyst summary'>
                            <p className='text-sm leading-6 text-ui-muted'>{summary.narrative || 'No analyst summary was saved with this report.'}</p>
                        </ReportPanel>
                        <ReportPanel title='Review list'>
                            <ReportList items={(summary.reviewQueue || []).map(item => `${item.severity || 'review'} · ${item.title || 'Evidence item'} · ${item.detail || item.evidence || item.source || ''}`)} empty='No priority review items saved.' />
                        </ReportPanel>
                        <ReportPanel title='Providers'>
                            <div className='grid gap-2'>
                                {(analystReport.providerReports || []).map(provider => (
                                    <div key={`${provider.tool}-${provider.url}`} className='rounded-md border border-ui-border bg-ui-raised p-3 text-sm'>
                                        <p className='font-semibold'>{provider.tool || 'Provider'} · {provider.status || 'unknown'}</p>
                                        <p className='mt-1 text-xs text-ui-muted'>{provider.verdict || 'No parsed verdict'}{provider.vendorFlagged !== undefined ? ` · ${provider.vendorFlagged}/${provider.vendorTotal || '?'} vendors` : ''}{provider.alertCount !== undefined ? ` · ${provider.alertCount} alerts` : ''}</p>
                                        {provider.url ? <p className='mt-1 truncate font-mono text-xs text-ui-muted'>{provider.url}</p> : null}
                                    </div>
                                ))}
                            </div>
                        </ReportPanel>
                        <ReportPanel title='Network evidence'>
                            <ReportList items={[
                                `${analystReport.networkEvidence?.requests || 0} requests`,
                                `${analystReport.networkEvidence?.responses || 0} responses`,
                                `${analystReport.networkEvidence?.blockedOrFailed || 0} blocked/failed`,
                                ...((analystReport.networkEvidence?.redirectChain || []).map(url => `redirect: ${url}`)),
                            ]} empty='No network evidence saved.' />
                        </ReportPanel>
                    </div>
                    <aside className='grid content-start gap-4'>
                        <ReportPanel title='Evidence checklist'>
                            <ReportList items={Object.entries(analystReport.evidenceChecklist || {}).map(([key, value]) => `${key}: ${value}`)} empty='No checklist saved.' />
                        </ReportPanel>
                        <ReportPanel title='Actions'>
                            <ReportList items={analystReport.recommendedActions || []} empty='No recommended actions saved.' />
                        </ReportPanel>
                        <ReportPanel title='Indicators'>
                            <pre className='max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-ui-border bg-ui-canvas p-3 text-xs text-ui-text'>{(summary.indicators || []).join('\n') || 'No indicators saved.'}</pre>
                        </ReportPanel>
                    </aside>
                </section>
            </section>
        </main>
    )
}

function ReportPanel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <h2 className='text-sm font-semibold uppercase text-ui-primary'>{title}</h2>
            <div className='mt-3'>{children}</div>
        </section>
    )
}

function ReportList({ items, empty }: { items: string[]; empty: string }) {
    const rows = items.map(item => item.trim()).filter(Boolean)
    if (!rows.length) return <p className='text-sm text-ui-muted'>{empty}</p>
    return <ul className='grid gap-2 text-sm text-ui-muted'>{rows.map(item => <li key={item} className='rounded-md border border-ui-border bg-ui-raised px-3 py-2'>{item}</li>)}</ul>
}
