const url = process.env.STATUS_BENCHMARK_URL || 'https://api.hanasand.com/api/status'
const budgetMs = Number(process.env.STATUS_BENCHMARK_BUDGET_MS || 5000)
const runs = Math.max(1, Number(process.env.STATUS_BENCHMARK_RUNS || 3))
const samples: Array<{ status: number; elapsedMs: number }> = []

for (let index = 0; index < runs; index += 1) {
    const started = performance.now()
    try {
        const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(budgetMs + 1000) })
        await response.arrayBuffer()
        samples.push({ status: response.status, elapsedMs: Math.round(performance.now() - started) })
    } catch {
        samples.push({ status: 599, elapsedMs: Math.round(performance.now() - started) })
    }
}

const failures = samples.filter(sample => sample.status !== 200 || sample.elapsedMs > budgetMs)
console.log(JSON.stringify({ url, budgetMs, runs, samples, ok: failures.length === 0 }, null, 2))
if (failures.length) process.exitCode = 1
