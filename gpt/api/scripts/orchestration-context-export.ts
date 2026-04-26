import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createContextExport, type ContextExportArtifact } from '../src/utils/orchestration/export.ts'
import { getRunDirectory } from '../src/utils/orchestration/paths.ts'
import { readRun, writeRunMarkdown } from '../src/utils/orchestration/store.ts'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const demoScript = path.join(scriptDir, 'orchestration-demo.ts')

const args = process.argv.slice(2)
const runFlagIndex = args.indexOf('--run')
const explicitRunId = runFlagIndex >= 0 ? args[runFlagIndex + 1] : null
const task = args
    .filter((arg, index) => index !== runFlagIndex && index !== runFlagIndex + 1)
    .join(' ')
    .trim() || 'Build a Next.js dashboard, verify Docker startup, and prepare a reviewer handoff.'

const runId = explicitRunId || await createDemoRun(task)
const run = await readRun(runId)

const healthyExport = createContextExport({
    run,
    profile: {
        id: 'healthy_export',
        label: 'Healthy export',
        mode: 'healthy',
        notes: ['Generated from the stored orchestration run without mutation.'],
    },
})

const degradedRun = {
    ...run,
    edges: run.edges.slice(1),
    context: {
        ...run.context,
        packs: run.context.packs.filter((pack, index) => index !== run.context.packs.length - 1),
    },
} satisfies typeof run

const degradedExport = createContextExport({
    run: degradedRun,
    profile: {
        id: 'degraded_export',
        label: 'Degraded export',
        mode: 'degraded',
        notes: [
            'Drops the last stored pack to simulate partial context persistence.',
            'Drops the first edge to simulate a disconnected branch.',
        ],
    },
})

const sweep = {
    runId,
    generatedAt: new Date().toISOString(),
    comparedProfiles: [healthyExport.profile.id, degradedExport.profile.id],
    findings: [
        compareGateDelta(healthyExport, degradedExport, 'pack_coverage'),
        compareGateDelta(healthyExport, degradedExport, 'hot_segment_coverage'),
        compareGateDelta(healthyExport, degradedExport, 'graph_integrity'),
        compareGateDelta(healthyExport, degradedExport, 'omission_pressure'),
    ],
    scopeComparison: healthyExport.scopes.map((scope) => {
        const degradedScope = degradedExport.scopes.find((entry) => entry.id === scope.id)
        return {
            scopeId: scope.id,
            healthyIncludedTokens: scope.includedTokens,
            degradedIncludedTokens: degradedScope?.includedTokens || 0,
            healthyOmissionRate: scope.omissionRate,
            degradedOmissionRate: degradedScope?.omissionRate ?? 1,
        }
    }),
    verdict: buildSweepVerdict(healthyExport, degradedExport),
} as const

const runDirectory = getRunDirectory(runId)
const healthyPath = path.join(runDirectory, 'context-export-healthy.json')
const degradedPath = path.join(runDirectory, 'context-export-degraded.json')
const sweepPath = path.join(runDirectory, 'context-export-sweep.json')
const summaryPath = path.join(runDirectory, 'context-export-summary.md')

await fs.writeFile(healthyPath, `${JSON.stringify(healthyExport, null, 2)}\n`, 'utf8')
await fs.writeFile(degradedPath, `${JSON.stringify(degradedExport, null, 2)}\n`, 'utf8')
await fs.writeFile(sweepPath, `${JSON.stringify(sweep, null, 2)}\n`, 'utf8')
await writeRunMarkdown(runId, path.basename(summaryPath), buildSummaryMarkdown({ healthyExport, degradedExport, sweep }))

console.log(JSON.stringify({
    ok: true,
    runId,
    healthyPath,
    degradedPath,
    sweepPath,
    summaryPath,
}, null, 2))

async function createDemoRun(taskArg: string) {
    const output = await runScript(demoScript, taskArg)
    const payload = JSON.parse(output) as { runId: string }
    return payload.runId
}

async function runScript(scriptPath: string, taskArg: string) {
    return await new Promise<string>((resolve, reject) => {
        const child = spawn('bun', [scriptPath, taskArg], {
            cwd: scriptDir,
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        child.on('error', reject)
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `Context export demo exited with ${code}`))
                return
            }
            resolve(stdout.trim())
        })
    })
}

function compareGateDelta(
    healthyExport: ContextExportArtifact,
    degradedExport: ContextExportArtifact,
    gateId: string,
) {
    const healthyGate = healthyExport.qualityGates.find((gate) => gate.id === gateId)
    const degradedGate = degradedExport.qualityGates.find((gate) => gate.id === gateId)
    return {
        gateId,
        healthyStatus: healthyGate?.status || 'missing',
        degradedStatus: degradedGate?.status || 'missing',
        healthySummary: healthyGate?.summary || 'missing',
        degradedSummary: degradedGate?.summary || 'missing',
    }
}

function buildSweepVerdict(
    healthyExport: ContextExportArtifact,
    degradedExport: ContextExportArtifact,
) {
    const healthyFailures = healthyExport.qualityGates.filter((gate) => gate.status === 'fail').length
    const degradedFailures = degradedExport.qualityGates.filter((gate) => gate.status === 'fail').length
    const healthyWarnings = healthyExport.qualityGates.filter((gate) => gate.status === 'warn').length
    const degradedWarnings = degradedExport.qualityGates.filter((gate) => gate.status === 'warn').length

    return {
        pass: healthyFailures === 0 && degradedFailures > healthyFailures,
        summary: healthyFailures === 0
            ? 'Healthy export meets the baseline while the degraded export trips stricter gates as expected.'
            : 'Healthy export still has failing gates and needs more context-pack reliability before this contract is trustworthy.',
        healthyFailures,
        degradedFailures,
        healthyWarnings,
        degradedWarnings,
    }
}

function buildSummaryMarkdown({
    healthyExport,
    degradedExport,
    sweep,
}: {
    healthyExport: ContextExportArtifact
    degradedExport: ContextExportArtifact
    sweep: {
        runId: string
        findings: ReadonlyArray<{
            gateId: string
            healthyStatus: string
            degradedStatus: string
            healthySummary?: string
            degradedSummary?: string
        }>
        verdict: { pass: boolean; summary: string }
    }
}) {
    const lines = [
        '# Context Export Sweep',
        '',
        `- Run: ${sweep.runId}`,
        `- Verdict: ${sweep.verdict.pass ? 'pass' : 'warn'}`,
        `- Summary: ${sweep.verdict.summary}`,
        '',
        '## Healthy export gates',
        ...healthyExport.qualityGates.map((gate) => `- ${gate.id}: ${gate.status} (${gate.summary})`),
        '',
        '## Degraded export gates',
        ...degradedExport.qualityGates.map((gate) => `- ${gate.id}: ${gate.status} (${gate.summary})`),
        '',
        '## Deltas',
        ...sweep.findings.map((finding) => `- ${finding.gateId}: ${finding.healthyStatus} -> ${finding.degradedStatus}`),
    ]
    return `${lines.join('\n')}\n`
}
