import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import { headers } from 'next/headers'
import EvaluationBenchmarkClient, { type Benchmark } from './evaluationBenchmarkClient'

export const dynamic = 'force-dynamic'

export default async function TiEvaluationPage() {
    const initialBenchmarks = await loadInitialBenchmarks()
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Extraction evaluation'
                description='Operational automatic evaluation over real retained evidence, with prediction-hidden model review, durable retries, independent adjudication, immutable labels, metrics, and drift.'
            />
            <EvaluationBenchmarkClient initialBenchmarks={initialBenchmarks} />
        </DashboardPage>
    )
}

async function loadInitialBenchmarks(): Promise<Benchmark[] | undefined> {
    try {
        const incoming = await headers()
        const host = incoming.get('x-forwarded-host')?.split(',')[0]?.trim() || incoming.get('host')
        if (!host) return undefined
        const protocol = incoming.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'
        const requestHeaders = { cookie: incoming.get('cookie') || '' }
        const responses = await Promise.all([
            fetch(new URL('/api/ti/evaluation/benchmarks?scope=global', `${protocol}://${host}`), { headers: requestHeaders, cache: 'no-store', signal: AbortSignal.timeout(12_000) }),
            fetch(new URL('/api/ti/evaluation/benchmarks?scope=default', `${protocol}://${host}`), { headers: requestHeaders, cache: 'no-store', signal: AbortSignal.timeout(12_000) }),
        ])
        if (responses.some(response => !response.ok)) return undefined
        const payloads = await Promise.all(responses.map(response => response.json() as Promise<{ benchmarks?: Benchmark[] }>))
        return payloads.flatMap(payload => payload.benchmarks || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    } catch {
        return undefined
    }
}
