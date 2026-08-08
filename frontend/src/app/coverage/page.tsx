import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Database, Rss, Timer } from 'lucide-react'
import { buildRouteMetadata } from '../seo'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = buildRouteMetadata({ title: 'Intelligence Feed Coverage', description: 'Measured useful and qualifying intelligence-feed coverage, baseline gaps, source inventory, and observed alert latency.', path: '/coverage', keywords: ['Hanasand intelligence feed coverage', 'alert latency'] })

type Family = 'clearWeb' | 'lawfulDarkWeb' | 'publicTelegram' | 'total'
type MeasuredCounts = Record<Family, number | null>
type Coverage = {
    generatedAt: string
    coverageBoundary: string
    registry: { registeredSourceCount: number; executableSourceCount: number; inactiveSourceCount: number }
    usefulCoverage: { measurementState: string; everUsefulSourceCount: number | null; currentlyUsefulSourceCount: number | null; sustainedUsefulSourceCount: number | null; captureProducingSourceCount: number | null }
    qualification: { measurementState: string; baseline: Record<Family, number>; counts: MeasuredCounts; gaps: MeasuredCounts; baselineMet: boolean | null }
    observedAlertLatencySeconds: { sampleCount: number; medianSeconds: number | null; p95Seconds: number | null }
    definitions: Record<string, string>
}

export default async function CoveragePage() {
    const coverage = await loadCoverage()
    return <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-10 text-ui-text md:px-8'><div className='mx-auto grid max-w-6xl gap-8'><header className='grid gap-4 border-b border-ui-border pb-8'><p className='text-sm font-semibold uppercase text-ui-primary'>Public measurement</p><h1 className='text-3xl font-semibold'>Intelligence feed coverage</h1><p className='max-w-3xl text-lg leading-8 text-ui-muted'>Coverage is counted only when a feed repeatedly produces useful retained intelligence and passes the qualification rules.</p><p className='text-xs text-ui-muted'>{coverage ? `Generated ${new Date(coverage.generatedAt).toLocaleString()}` : 'Coverage data is unavailable right now.'}</p></header>{coverage ? <CoverageContent coverage={coverage} /> : <Unavailable />}</div></main>
}

function CoverageContent({ coverage }: { coverage: Coverage }) {
    const measured = coverage.qualification.measurementState === 'measured'
    const latency = coverage.observedAlertLatencySeconds
    return <>
        <section className='grid gap-3 md:grid-cols-3'>
            <Metric icon={<Rss className='h-5 w-5' />} label='Qualifying feeds' value={measured ? `${coverage.qualification.counts.total} / ${coverage.qualification.baseline.total}` : 'Not measured'} detail={measured ? `${coverage.qualification.gaps.total} remaining across the required family mix` : 'Persisted qualification metrics are unavailable'} />
            <Metric icon={<Database className='h-5 w-5' />} label='Capture-producing feeds' value={formatMeasured(coverage.usefulCoverage.captureProducingSourceCount)} detail={`${formatMeasured(coverage.usefulCoverage.sustainedUsefulSourceCount)} sustained across repeated useful cycles`} />
            <Metric icon={<Timer className='h-5 w-5' />} label='Observed alert latency' value={latency.medianSeconds === null ? 'No observations' : formatSeconds(latency.medianSeconds)} detail={latency.p95Seconds === null ? 'Awaiting verified report-to-alert records' : `p95 ${formatSeconds(latency.p95Seconds)} · ${latency.sampleCount} samples`} />
        </section>
        <QualificationTable qualification={coverage.qualification} />
        <section className='grid gap-4 border-t border-ui-border pt-6'><div><h2 className='text-lg font-semibold'>Source registry inventory</h2><p className='mt-1 text-sm text-ui-muted'>Inventory is reported separately and is never added to qualifying coverage.</p></div><div className='grid gap-3 sm:grid-cols-3'><Inventory label='Registered' value={coverage.registry.registeredSourceCount} /><Inventory label='Executable' value={coverage.registry.executableSourceCount} /><Inventory label='Inactive' value={coverage.registry.inactiveSourceCount} /></div></section>
        <section className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5'><h2 className='text-lg font-semibold'>Measurement definitions</h2><div className='grid gap-3 text-sm leading-6 text-ui-muted md:grid-cols-2'>{Object.entries(coverage.definitions).map(([key, value]) => <div key={key}><p className='font-semibold capitalize text-ui-text'>{key}</p><p>{value}</p></div>)}</div><p className='border-t border-ui-border pt-3 text-sm text-ui-muted'>{coverage.coverageBoundary}</p><Link href='/trust' className='inline-flex items-center gap-2 text-sm font-semibold text-ui-primary'>Review the trust center <ArrowRight className='h-4 w-4' /></Link></section>
    </>
}

function QualificationTable({ qualification }: { qualification: Coverage['qualification'] }) {
    const rows: Array<[Family, string]> = [['clearWeb', 'Clear web'], ['lawfulDarkWeb', 'Lawful dark web / Tor'], ['publicTelegram', 'Public Telegram']]
    const measured = qualification.measurementState === 'measured'
    return <section className='overflow-x-auto rounded-lg border border-ui-border bg-ui-panel'><table className='w-full min-w-[36rem] text-left text-sm'><thead className='bg-ui-raised text-ui-muted'><tr><th className='px-4 py-3 font-semibold'>Feed family</th><th className='px-4 py-3 font-semibold'>Qualifying</th><th className='px-4 py-3 font-semibold'>Required minimum</th><th className='px-4 py-3 font-semibold'>Remaining gap</th></tr></thead><tbody>{rows.map(([key, label]) => <tr key={key} className='border-t border-ui-border'><td className='px-4 py-3 font-medium'>{label}</td><td className='px-4 py-3'>{measured ? qualification.counts[key] : 'Not measured'}</td><td className='px-4 py-3'>{qualification.baseline[key]}</td><td className='px-4 py-3'>{measured ? qualification.gaps[key] : 'Not measured'}</td></tr>)}</tbody></table></section>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-5'><span className='text-ui-primary'>{icon}</span><div><p className='text-sm text-ui-muted'>{label}</p><p className='mt-1 text-xl font-semibold'>{value}</p><p className='mt-1 text-xs text-ui-muted'>{detail}</p></div></div> }
function Inventory({ label, value }: { label: string; value: number }) { return <div className='border-l-2 border-ui-border pl-3'><p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p><p className='mt-1 text-xl font-semibold'>{value}</p></div> }
function formatMeasured(value: number | null) { return value === null ? 'Not measured' : String(value) }
function formatSeconds(value: number) { return value < 60 ? `${Math.round(value)}s` : `${(value / 60).toFixed(value >= 3600 ? 1 : 0)}${value >= 3600 ? 'h' : 'm'}` }
function Unavailable() { return <section className='rounded-lg border border-ui-border bg-ui-panel p-6'><h2 className='font-semibold'>Coverage data is unavailable</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>The measurement service did not respond. No fallback counts are shown.</p></section> }
async function loadCoverage(): Promise<Coverage | null> { try { const response = await fetch(new URL('/v1/public/coverage', tiScraperApiBase()), { cache: 'no-store', signal: AbortSignal.timeout(10_000) }); return response.ok ? await response.json() as Coverage : null } catch { return null } }
