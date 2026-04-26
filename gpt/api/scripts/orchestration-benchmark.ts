import fs from 'node:fs/promises'
import os from 'node:os'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContextExport } from '../src/utils/orchestration/export.ts'
import { getOrchestrationRoot } from '../src/utils/orchestration/paths.ts'
import { readRun } from '../src/utils/orchestration/store.ts'
import type { OrchestratorAgentRole } from '../src/utils/orchestration/types.ts'

type ScenarioProfile = {
    branchPolicy?: {
        maxBranches: number
        maxDepth: number
    }
    workerProfile?: {
        tension: 'baseline' | 'context_pressure' | 'partial_failure' | 'contested'
        contradictionMode?: boolean
        expectedBlockedRoles?: OrchestratorAgentRole[]
    }
    additionalContext?: Array<{
        label: string
        kind: 'task' | 'constraint' | 'memory' | 'artifact' | 'repo_summary'
        temperature: 'hot' | 'warm' | 'cold'
        roleAffinity: OrchestratorAgentRole[]
        branchKey?: string | null
        content: string
        priority?: number
    }>
}

type Scenario = {
    id: string
    label: string
    task: string
    expectedRoles: OrchestratorAgentRole[]
    expectedBlockedRoles?: OrchestratorAgentRole[]
    requiresContextPressure?: boolean
    requiresContradiction?: boolean
    profile?: ScenarioProfile
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..', '..')
const controlPlaneDir = path.join(repoRoot, 'agents', 'control-plane')
const draftPacketsDir = path.join(controlPlaneDir, 'draft-packets')
const demoScript = path.join(scriptDir, 'orchestration-demo.ts')
const repeatSentence = (value: string, times: number) => Array.from({ length: times }, () => value).join(' ')
const outputDir = getOrchestrationRoot()
const latestJsonPath = path.join(outputDir, 'benchmark-latest.json')
const previousReport = await readPreviousBenchmark(latestJsonPath)
const difficultyProfile = deriveDifficultyProfile(previousReport)
const scaledRepeat = (times: number) => Math.max(1, Math.round(times * difficultyProfile.repeatMultiplier))
const latestTrendJsonPath = path.join(outputDir, 'benchmark-trend-latest.json')
const latestTrendMdPath = path.join(outputDir, 'benchmark-trend-latest.md')

const scenarios: Scenario[] = [
    {
        id: 'delivery_handoff',
        label: 'Delivery and handoff',
        task: 'Build a Next.js dashboard, verify Docker startup, and prepare a reviewer handoff.',
        expectedRoles: ['implementation', 'builder', 'reviewer'],
        profile: {
            workerProfile: {
                tension: 'baseline',
            },
        },
    },
    {
        id: 'delivery_handoff_pressure_refresh',
        label: 'Delivery handoff under noisy verification pressure',
        task: 'Build a Next.js dashboard, verify Docker startup, and prepare a reviewer handoff while noisy side threads and a flaky builder branch compete for attention.',
        expectedRoles: ['implementation', 'builder', 'reviewer'],
        expectedBlockedRoles: ['builder'],
        requiresContextPressure: true,
        profile: {
            workerProfile: {
                tension: 'partial_failure',
                expectedBlockedRoles: ['builder'],
            },
            additionalContext: [
                {
                    label: 'Reviewer handoff contract',
                    kind: 'constraint',
                    temperature: 'hot',
                    roleAffinity: ['implementation', 'reviewer'],
                    content: repeatSentence('The final handoff must separate shipped UI changes, blocked verification, and the exact next command needed to unstick the builder branch.', scaledRepeat(180)),
                    priority: 5,
                },
                {
                    label: 'Flaky builder note',
                    kind: 'artifact',
                    temperature: 'hot',
                    roleAffinity: ['builder', 'reviewer'],
                    content: repeatSentence('Docker startup now passes once and then stalls on the second verification attempt, so the builder branch must stay honest about what is still unproven.', scaledRepeat(170)),
                    priority: 5,
                },
                {
                    label: 'Unrelated design polish thread',
                    kind: 'memory',
                    temperature: 'cold',
                    roleAffinity: ['implementation', 'builder', 'reviewer'],
                    content: repeatSentence('Long thread about color polish, naming bikeshedding, unrelated layout tweaks, and screenshots from an older dashboard version that should not dominate the packed context.', scaledRepeat(260)),
                    priority: 1,
                },
                {
                    label: 'Duplicate QA chatter',
                    kind: 'memory',
                    temperature: 'cold',
                    roleAffinity: ['implementation', 'builder', 'reviewer'],
                    content: repeatSentence('Repeated QA chatter restates the same issues in slightly different words and adds no new evidence, but it consumes a large amount of context if not compressed.', scaledRepeat(240)),
                    priority: 1,
                },
            ],
        },
    },
    {
        id: 'context_pressure_triage',
        label: 'Context-pressure triage',
        task: 'Triage a deployment under heavy context pressure, preserve the hottest constraints, and produce a reviewer handoff.',
        expectedRoles: ['implementation', 'builder', 'reviewer'],
        requiresContextPressure: true,
        profile: {
            workerProfile: {
                tension: 'context_pressure',
            },
            additionalContext: [
                {
                    label: 'Hot incident notes',
                    kind: 'memory',
                    temperature: 'hot',
                    roleAffinity: ['implementation', 'builder', 'reviewer'],
                    content: repeatSentence('Incident bridge notes mention three conflicting symptoms, one stale workaround, and a non-negotiable uptime promise for the next deploy window.', scaledRepeat(180)),
                    priority: 5,
                },
                {
                    label: 'Rollback guardrails',
                    kind: 'constraint',
                    temperature: 'hot',
                    roleAffinity: ['builder', 'reviewer'],
                    content: repeatSentence('Do not recommend rollback unless the branch can show which state is restorable and which checks remain unknown.', scaledRepeat(170)),
                    priority: 5,
                },
                {
                    label: 'Dense repo summary',
                    kind: 'repo_summary',
                    temperature: 'warm',
                    roleAffinity: ['implementation', 'builder'],
                    content: repeatSentence('Workspace spans frontend, API, deploy scripts, and control-plane docs. Prioritize the files that most directly affect the failing preview route and omit cosmetic changes.', scaledRepeat(150)),
                    priority: 4,
                },
                {
                    label: 'Reviewer disagreement note',
                    kind: 'artifact',
                    temperature: 'warm',
                    roleAffinity: ['reviewer'],
                    content: repeatSentence('A previous review approved shipping, but a later note questions whether the verification logs were complete.', scaledRepeat(150)),
                    priority: 4,
                },
                {
                    label: 'Low-priority backlog 1',
                    kind: 'memory',
                    temperature: 'cold',
                    roleAffinity: ['implementation'],
                    content: repeatSentence('Backlog thread about unrelated naming cleanup in dashboard copy.', scaledRepeat(220)),
                    priority: 1,
                },
                {
                    label: 'Low-priority backlog 2',
                    kind: 'memory',
                    temperature: 'cold',
                    roleAffinity: ['builder'],
                    content: repeatSentence('Old package-manager migration note that should not displace hot deploy context.', scaledRepeat(220)),
                    priority: 1,
                },
            ],
        },
    },
    {
        id: 'deploy_diagnosis',
        label: 'Deploy diagnosis',
        task: 'Diagnose why Docker compose verification keeps failing, propose fixes, and prepare a final review.',
        expectedRoles: ['implementation', 'builder', 'reviewer'],
        expectedBlockedRoles: ['builder'],
        profile: {
            workerProfile: {
                tension: 'partial_failure',
                expectedBlockedRoles: ['builder'],
            },
            additionalContext: [
                {
                    label: 'Failing runtime signal',
                    kind: 'artifact',
                    temperature: 'hot',
                    roleAffinity: ['builder', 'reviewer'],
                    content: 'Healthcheck flaps between ready and timeout, and the deployment should stay honest if the root cause is unresolved.',
                    priority: 5,
                },
                {
                    label: 'Manual step caveat',
                    kind: 'constraint',
                    temperature: 'warm',
                    roleAffinity: ['implementation', 'builder', 'reviewer'],
                    content: 'If the build branch cannot prove a fix, the final answer should preserve the blocked state and ask for a narrower next action.',
                    priority: 4,
                },
            ],
        },
    },
    {
        id: 'pressure_blocked_release',
        label: 'Pressure plus blocked release',
        task: 'Handle a release candidate with too much noisy context, a blocked build branch, and a reviewer that needs a concise final recommendation.',
        expectedRoles: ['implementation', 'builder', 'reviewer'],
        expectedBlockedRoles: ['builder'],
        requiresContextPressure: true,
        profile: {
            workerProfile: {
                tension: 'partial_failure',
                expectedBlockedRoles: ['builder'],
            },
            additionalContext: [
                {
                    label: 'Release stop condition',
                    kind: 'constraint',
                    temperature: 'hot',
                    roleAffinity: ['builder', 'reviewer'],
                    content: repeatSentence('The release must not be marked shippable if the builder cannot prove the healthcheck and rollback evidence.', scaledRepeat(160)),
                    priority: 5,
                },
                {
                    label: 'Noisy customer thread',
                    kind: 'memory',
                    temperature: 'cold',
                    roleAffinity: ['implementation', 'builder', 'reviewer'],
                    content: repeatSentence('Long customer thread with duplicate symptoms, old screenshots, outdated assumptions, and several irrelevant UI complaints.', scaledRepeat(260)),
                    priority: 1,
                },
                {
                    label: 'Reviewer synthesis hint',
                    kind: 'artifact',
                    temperature: 'warm',
                    roleAffinity: ['reviewer'],
                    content: repeatSentence('Final answer should separate proven facts, unresolved deploy risk, and the next verification command.', scaledRepeat(120)),
                    priority: 4,
                },
            ],
        },
    },
    {
        id: 'delivery_handoff_escalated',
        label: 'Escalated delivery handoff',
        task: 'Build a Next.js dashboard, verify Docker startup, and prepare a reviewer handoff. Add extra noise, a blocked verification branch, and contradictory reviewer evidence before deciding whether to ship.',
        expectedRoles: ['implementation', 'builder', 'reviewer'],
        expectedBlockedRoles: ['builder'],
        requiresContextPressure: true,
        requiresContradiction: true,
        profile: {
            branchPolicy: {
                maxBranches: 4,
                maxDepth: 3,
            },
            workerProfile: {
                tension: 'contested',
                contradictionMode: true,
                expectedBlockedRoles: ['builder'],
            },
            additionalContext: [
                {
                    label: 'Escalated incident brief',
                    kind: 'task',
                    temperature: 'hot',
                    roleAffinity: ['implementation', 'builder', 'reviewer'],
                    content: repeatSentence('A previously easy delivery handoff now includes a fragile release candidate, missing verification evidence, and explicit pressure to summarize only what is truly proven.', scaledRepeat(170)),
                    priority: 5,
                },
                {
                    label: 'Builder stop-ship evidence',
                    kind: 'artifact',
                    temperature: 'hot',
                    roleAffinity: ['builder', 'reviewer'],
                    content: repeatSentence('The builder branch found a failing healthcheck after docker compose verification. Do not convert that blocked branch into a false-green handoff.', scaledRepeat(150)),
                    priority: 5,
                },
                {
                    label: 'Conflicting ship-now request',
                    kind: 'artifact',
                    temperature: 'hot',
                    roleAffinity: ['implementation', 'reviewer'],
                    content: repeatSentence('A product stakeholder still wants to ship immediately and asks for a concise recommendation that hides the blocked verification branch.', scaledRepeat(145)),
                    priority: 5,
                },
                {
                    label: 'Reviewer merge constraint',
                    kind: 'constraint',
                    temperature: 'warm',
                    roleAffinity: ['reviewer'],
                    content: repeatSentence('The reviewer must reconcile the ship-now request against the blocked evidence and write an explicit merge decision instead of hand-waving the disagreement away.', scaledRepeat(135)),
                    priority: 4,
                },
                {
                    label: 'Noisy thread replay',
                    kind: 'memory',
                    temperature: 'cold',
                    roleAffinity: ['implementation', 'builder', 'reviewer'],
                    content: repeatSentence('Long duplicate customer chatter, repeated screenshots, stale workaround notes, and unrelated UI complaints that should not displace the hotter release evidence.', scaledRepeat(340)),
                    priority: 1,
                },
                {
                    label: 'Backlog copy thread',
                    kind: 'memory',
                    temperature: 'cold',
                    roleAffinity: ['implementation'],
                    content: repeatSentence('Unrelated backlog copy edits for dashboard marketing text that should stay beneath the deploy and handoff evidence.', scaledRepeat(260)),
                    priority: 1,
                },
            ],
        },
    },
    {
        id: 'contested_merge_decision',
        label: 'Contested merge decision',
        task: 'Review a risky deploy fix where one branch wants to ship and another wants to hold, then justify the final recommendation.',
        expectedRoles: ['implementation', 'builder', 'reviewer'],
        requiresContradiction: true,
        profile: {
            workerProfile: {
                tension: 'contested',
                contradictionMode: true,
            },
            additionalContext: [
                {
                    label: 'Shipping argument',
                    kind: 'artifact',
                    temperature: 'hot',
                    roleAffinity: ['implementation', 'builder'],
                    content: 'Implementation notes say the patch is narrowly scoped and likely safe to ship immediately.',
                    priority: 5,
                },
                {
                    label: 'Hold argument',
                    kind: 'artifact',
                    temperature: 'hot',
                    roleAffinity: ['reviewer'],
                    content: 'Reviewer notes say the patch hides an unresolved tenant-boundary side effect and needs a documented merge decision.',
                    priority: 5,
                },
            ],
        },
    },
]

if (difficultyProfile.level >= 2) {
    scenarios.splice(scenarios.length - 1, 0, {
        id: 'adaptive_noise_escalation',
        label: 'Adaptive noise escalation',
        task: 'Handle a benchmark case that intentionally raises context noise after previous high-scoring runs and still preserve the reviewer-critical evidence.',
        expectedRoles: ['implementation', 'builder', 'reviewer'],
        requiresContextPressure: true,
        profile: {
            workerProfile: {
                tension: 'context_pressure',
            },
            additionalContext: [
                {
                    label: 'Escalated hot deploy thread',
                    kind: 'memory',
                    temperature: 'hot',
                    roleAffinity: ['implementation', 'builder', 'reviewer'],
                    content: repeatSentence('This adaptive scenario exists because the previous benchmark run saturated the easier suite, so the model must protect the critical deploy evidence even as context volume grows.', scaledRepeat(220)),
                    priority: 5,
                },
                {
                    label: 'Escalated cold chatter',
                    kind: 'memory',
                    temperature: 'cold',
                    roleAffinity: ['implementation', 'builder', 'reviewer'],
                    content: repeatSentence('Long noisy follow-up chatter with duplicated symptoms, social commentary, and stale workaround notes that should not dominate the packed context.', scaledRepeat(320)),
                    priority: 1,
                },
            ],
        },
    })
}

const generatedAt = new Date().toISOString()
const scenarioResults = []

for (const scenario of scenarios) {
    const payload = await runDemo(scenario)
    const run = await readRun(payload.runId)
    const exportArtifact = createContextExport({
        run,
        profile: {
            id: `${scenario.id}_benchmark`,
            label: `${scenario.label} benchmark export`,
            mode: 'healthy',
            notes: ['Generated during orchestration benchmark suite execution.'],
        },
    })

    const workerNodes = run.nodes.filter((node) => node.role !== 'orchestrator')
    const observedRoles = [...new Set(workerNodes.map((node) => node.role))]
    const packedNodeIds = new Set(run.context.packs.map((pack) => pack.nodeId))
    const artifactNodeIds = new Set(
        run.events
            .filter((event) => event.artifacts.length > 0)
            .map((event) => event.nodeId),
    )
    const blockedRoles = [...new Set(
        run.events
            .filter((event) => event.state === 'blocked')
            .map((event) => event.role),
    )]
    const combinedEventText = run.events
        .flatMap((event) => [event.summary, event.detail || '', ...event.artifacts.map((artifact) => artifact.content || '')])
        .join('\n')
        .toLowerCase()

    const expectedRoleHits = scenario.expectedRoles.filter((role) => observedRoles.includes(role)).length
    const roleCoverage = scenario.expectedRoles.length > 0 ? expectedRoleHits / scenario.expectedRoles.length : 1
    const packCoverage = workerNodes.length > 0
        ? workerNodes.filter((node) => packedNodeIds.has(node.id)).length / workerNodes.length
        : 1
    const evidenceCoverage = workerNodes.length > 0
        ? workerNodes.filter((node) => artifactNodeIds.has(node.id)).length / workerNodes.length
        : 1
    const blockedRoleCoverage = scenario.expectedBlockedRoles?.length
        ? scenario.expectedBlockedRoles.filter((role) => blockedRoles.includes(role)).length / scenario.expectedBlockedRoles.length
        : 1
    const omittedHotSegments = run.context.packs.reduce((total, pack) => total + pack.omitted.filter((segment) => /hot|same branch|role match/i.test(segment.reason)).length, 0)
    const contextPressureCoverage = scenario.requiresContextPressure
        ? omittedHotSegments > 0 || run.context.packs.some((pack) => pack.omitted.length > 0) ? 1 : 0
        : 1
    const contradictionCoverage = scenario.requiresContradiction
        ? run.events.some((event) => event.type === 'merge_resolved') && /merge decision|hold/.test(combinedEventText) ? 1 : 0
        : 1

    const exportPassCount = exportArtifact.qualityGates.filter((gate) => gate.status === 'pass').length
    const exportWarnCount = exportArtifact.qualityGates.filter((gate) => gate.status === 'warn').length
    const exportFailCount = exportArtifact.qualityGates.filter((gate) => gate.status === 'fail').length
    const exportGateHealth = exportArtifact.qualityGates.length > 0
        ? (exportPassCount + exportWarnCount * 0.5) / exportArtifact.qualityGates.length
        : 1
    const replayExists = await fileExists(payload.replayPath)

    const score = Math.round(
        roleCoverage * 20
        + packCoverage * 18
        + evidenceCoverage * 12
        + exportGateHealth * 15
        + contextPressureCoverage * 10
        + blockedRoleCoverage * 10
        + contradictionCoverage * 10
        + (replayExists ? 5 : 0),
    )

    scenarioResults.push({
        id: scenario.id,
        label: scenario.label,
        task: scenario.task,
        runId: payload.runId,
        replayPath: payload.replayPath,
        expectedRoles: scenario.expectedRoles,
        observedRoles,
        score,
        status: exportFailCount > 0 || score < 75 ? 'fail' : score < 90 ? 'warn' : 'pass',
        metrics: {
            roleCoverage,
            packCoverage,
            evidenceCoverage,
            exportGateHealth,
            replayExists,
            exportPassCount,
            exportWarnCount,
            exportFailCount,
            blockedRoleCoverage,
            contextPressureCoverage,
            contradictionCoverage,
            omittedHotSegments,
            eventCount: run.events.length,
            artifactCount: run.events.reduce((total, event) => total + event.artifacts.length, 0),
        },
        failedGates: exportArtifact.qualityGates
            .filter((gate) => gate.status === 'fail')
            .map((gate) => gate.id),
        warningGates: exportArtifact.qualityGates
            .filter((gate) => gate.status === 'warn')
            .map((gate) => gate.id),
    })
}

const averageScore = Math.round(
    scenarioResults.reduce((total, entry) => total + entry.score, 0) / scenarioResults.length,
)
const weakestScenario = [...scenarioResults].sort((left, right) => left.score - right.score)[0]
const benchmarkHistory = await readBenchmarkHistory(outputDir)
const trend = buildTrendSignal({
    generatedAt,
    history: benchmarkHistory,
    averageScore,
    scenarioResults,
    weakestScenario,
})
const recommendations = buildRecommendations({ averageScore, scenarioResults })
const draftPackets = buildDraftPackets({ generatedAt, recommendations, weakestScenario })
const difficulty = buildDifficultySignal({ averageScore, scenarioResults })
const report = {
    generated_at: generatedAt,
    suite: 'orchestration_benchmark_v2',
    difficulty_profile: difficultyProfile,
    average_score: averageScore,
    scenario_count: scenarioResults.length,
    passing_scenarios: scenarioResults.filter((entry) => entry.status === 'pass').length,
    warning_scenarios: scenarioResults.filter((entry) => entry.status === 'warn').length,
    failing_scenarios: scenarioResults.filter((entry) => entry.status === 'fail').length,
    weakest_scenario: weakestScenario
        ? { id: weakestScenario.id, label: weakestScenario.label, score: weakestScenario.score }
        : null,
    scenario_results: scenarioResults,
    recommendations,
    draft_packets: draftPackets,
    difficulty,
    trend,
}

await fs.mkdir(outputDir, { recursive: true })
const timestamp = generatedAt.replace(/[:.]/g, '-')
const latestMdPath = path.join(outputDir, 'benchmark-latest.md')
const archiveJsonPath = path.join(outputDir, `benchmark-${timestamp}.json`)

await fs.writeFile(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
await fs.writeFile(archiveJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
await fs.writeFile(latestMdPath, `${renderBenchmarkMarkdown(report)}\n`, 'utf8')
await fs.writeFile(latestTrendJsonPath, `${JSON.stringify(trend, null, 2)}\n`, 'utf8')
await fs.writeFile(latestTrendMdPath, `${renderTrendMarkdown(trend)}\n`, 'utf8')
await writeDraftPackets(draftPackets)

console.log(JSON.stringify({
    ok: true,
    averageScore,
    latestJsonPath,
    latestMdPath,
    latestTrendJsonPath,
    latestTrendMdPath,
    archiveJsonPath,
}, null, 2))

async function runDemo(scenario: Scenario) {
    const scenarioFilePath = path.join(os.tmpdir(), `hanasand-orchestration-scenario-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
    await fs.writeFile(scenarioFilePath, `${JSON.stringify({
        id: scenario.id,
        label: scenario.label,
        task: scenario.task,
        branchPolicy: scenario.profile?.branchPolicy,
        workerProfile: scenario.profile?.workerProfile,
        additionalContext: scenario.profile?.additionalContext || [],
    }, null, 2)}\n`, 'utf8')

    try {
        const output = await new Promise<string>((resolve, reject) => {
            const child = spawn('bun', [demoScript, '--scenario-file', scenarioFilePath], {
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
                    reject(new Error(stderr || `Benchmark demo exited with ${code}`))
                    return
                }
                resolve(stdout.trim())
            })
        })

        return JSON.parse(output) as {
            ok: boolean
            runId: string
            replayPath: string
        }
    } finally {
        await fs.unlink(scenarioFilePath).catch(() => {})
    }
}

function buildRecommendations({
    averageScore,
    scenarioResults,
}: {
    averageScore: number
    scenarioResults: Array<{
        id: string
        status: string
        metrics: {
            exportGateHealth: number
            evidenceCoverage: number
            blockedRoleCoverage: number
            contextPressureCoverage: number
            contradictionCoverage: number
        }
    }>
}) {
    const recommendations = []
    const lowEvidence = scenarioResults.some((entry) => entry.metrics.evidenceCoverage < 1)
    const weakExport = scenarioResults.some((entry) => entry.status !== 'pass')
    const weakPressure = scenarioResults.some((entry) =>
        entry.metrics.contextPressureCoverage < 1
        || entry.metrics.blockedRoleCoverage < 1
        || entry.metrics.contradictionCoverage < 1,
    )
    const hasHardCorpusRefresh = scenarioResults.some((entry) => entry.id === 'delivery_handoff_pressure_refresh')

    if (weakExport) {
        recommendations.push({
            id: 'context_pack_omission_budget',
            severity: 'high',
            summary: 'Reduce context-pack omission failures under pressure.',
            rationale: 'The current weakest scenario preserves role coverage but still fails an export quality gate when hot context pressure rises.',
            suggestedPacket: 72,
        })
    }

    if ((!hasHardCorpusRefresh && averageScore >= 90) || weakPressure) {
        recommendations.push({
            id: 'hard_scenario_corpus',
            severity: weakPressure ? 'high' : 'medium',
            summary: 'Add harder orchestration scenarios with context pressure and partial-failure branches.',
            rationale: 'The suite now validates the real orchestration loop, but more varied pressure cases would make regressions harder to miss.',
            suggestedPacket: 73,
        })
    }

    if (lowEvidence || scenarioResults.some((entry) => entry.metrics.contradictionCoverage < 1)) {
        recommendations.push({
            id: 'branch_merge_contradictions',
            severity: lowEvidence || weakPressure ? 'high' : 'medium',
            summary: 'Teach branch outputs to disagree, merge, and justify final decisions more explicitly.',
            rationale: 'Contradiction handling should remain benchmark-driven when evidence or merge-resolution coverage drops.',
            suggestedPacket: 74,
        })
    }

    return recommendations
}

function buildDraftPackets({
    generatedAt,
    recommendations,
    weakestScenario,
}: {
    generatedAt: string
    recommendations: ReturnType<typeof buildRecommendations>
    weakestScenario?: { id: string; label: string; score: number } | null
}) {
    return recommendations
        .map((recommendation, index) => {
            const priorityScore = recommendation.severity === 'high' ? 100 - index * 5 : 70 - index * 5
            const slug = recommendation.id.replace(/_/g, '-')
            return {
                id: `draft-${generatedAt.slice(0, 10)}-${slug}`,
                priority: index + 1,
                priorityScore,
                suggestedPacket: recommendation.suggestedPacket,
                sourceRecommendation: recommendation.id,
                severity: recommendation.severity,
                title: titleCase(recommendation.summary.replace(/\.$/, '')),
                slug,
                objective: recommendation.summary,
                rationale: recommendation.rationale,
                benchmarkEvidence: weakestScenario
                    ? `Weakest scenario: ${weakestScenario.label} (${weakestScenario.score}).`
                    : 'No weak scenario was identified.',
                acceptance: [
                    'The next benchmark run records the changed behavior.',
                    'The result note links the benchmark evidence that motivated the work.',
                    'The packet can be evaluated without rereading chat history.',
                ],
            }
        })
        .sort((left, right) => right.priorityScore - left.priorityScore || left.priority - right.priority)
}

function buildDifficultySignal({
    averageScore,
    scenarioResults,
}: {
    averageScore: number
    scenarioResults: Array<{ status: string }>
}) {
    const allPassing = scenarioResults.length > 0 && scenarioResults.every((entry) => entry.status === 'pass')
    if (allPassing && averageScore >= 98) {
        return {
            state: 'increase',
            reason: 'All scenarios passed with a near-perfect average score; the next benchmark loop should add harder pressure cases.',
            nextScenarioSeed: 'Combine context pressure, partial failure, and contradictory reviewer evidence in one run.',
        }
    }

    return {
        state: 'hold',
        reason: 'The current suite still has failing or warning pressure, so fix regressions before adding difficulty.',
        nextScenarioSeed: null,
    }
}

async function writeDraftPackets(draftPackets: ReturnType<typeof buildDraftPackets>) {
    await fs.mkdir(draftPacketsDir, { recursive: true })
    for (const draft of draftPackets) {
        const draftPath = path.join(draftPacketsDir, `${String(draft.suggestedPacket).padStart(2, '0')}-${draft.slug}.md`)
        await fs.writeFile(draftPath, `${renderDraftPacketMarkdown(draft)}\n`, 'utf8')
    }

    await fs.writeFile(path.join(draftPacketsDir, 'priority-queue.json'), `${JSON.stringify({
        generated_at: generatedAt,
        drafts: draftPackets,
    }, null, 2)}\n`, 'utf8')
    await fs.writeFile(path.join(draftPacketsDir, 'priority-queue.md'), `${renderDraftPriorityMarkdown(draftPackets)}\n`, 'utf8')
}

function renderBenchmarkMarkdown(report: {
    generated_at: string
    difficulty_profile: {
        level: number
        trigger: string
        repeatMultiplier: number
        adaptiveScenarioEnabled: boolean
        previousAverageScore: number | null
    }
    average_score: number
    scenario_count: number
    passing_scenarios: number
    warning_scenarios: number
    failing_scenarios: number
    weakest_scenario: { label: string; score: number } | null
    scenario_results: Array<{
        label: string
        status: string
        score: number
        metrics: {
            roleCoverage: number
            packCoverage: number
            evidenceCoverage: number
            exportGateHealth: number
            blockedRoleCoverage: number
            contextPressureCoverage: number
            contradictionCoverage: number
        }
    }>
    recommendations: Array<{
        suggestedPacket: number
        summary: string
        rationale: string
    }>
    draft_packets: Array<{
        suggestedPacket: number
        title: string
        priorityScore: number
        severity: string
    }>
    difficulty: {
        state: string
        reason: string
        nextScenarioSeed: string | null
    }
    trend: {
        status: string
        regressionRule: string
        summary: string
        comparedRunCount: number
        latestGeneratedAt: string
        previousGeneratedAt: string | null
        averageScoreDelta: number | null
        weakestScenarioDelta: {
            id: string | null
            label: string | null
            currentScore: number | null
            previousScore: number | null
            delta: number | null
        }
        omissionPressureDelta: {
            currentOmittedHotSegments: number
            previousOmittedHotSegments: number | null
            delta: number | null
        }
        regressionSignals: string[]
        improvementSignals: string[]
        historyWindow: Array<{
            generatedAt: string
            averageScore: number
            weakestScenario: string
            omittedHotSegments: number
        }>
    }
}) {
    return `# Orchestration Benchmark

Updated: ${report.generated_at.slice(0, 10)}

## Summary
- difficulty level: ${report.difficulty_profile.level} (${report.difficulty_profile.trigger})
- repeat multiplier: ${report.difficulty_profile.repeatMultiplier}
- adaptive scenario enabled: ${report.difficulty_profile.adaptiveScenarioEnabled ? 'yes' : 'no'}
- average score: ${report.average_score}
- scenarios: ${report.scenario_count}
- pass / warn / fail: ${report.passing_scenarios} / ${report.warning_scenarios} / ${report.failing_scenarios}
- weakest scenario: ${report.weakest_scenario ? `${report.weakest_scenario.label} (${report.weakest_scenario.score})` : 'none'}

## Scenario results
${report.scenario_results.map((entry) => `- ${entry.label}: ${entry.status} (${entry.score}) role=${entry.metrics.roleCoverage.toFixed(2)} pack=${entry.metrics.packCoverage.toFixed(2)} evidence=${entry.metrics.evidenceCoverage.toFixed(2)} export=${entry.metrics.exportGateHealth.toFixed(2)} pressure=${entry.metrics.contextPressureCoverage.toFixed(2)} blocked=${entry.metrics.blockedRoleCoverage.toFixed(2)} contradiction=${entry.metrics.contradictionCoverage.toFixed(2)}`).join('\n')}

## Recommended next packets
${report.recommendations.map((entry) => `- ${entry.suggestedPacket}: ${entry.summary} ${entry.rationale}`).join('\n')}

## Draft packet queue
${report.draft_packets.map((entry) => `- packet ${entry.suggestedPacket}: ${entry.title} priority=${entry.priorityScore} severity=${entry.severity}`).join('\n') || 'none'}

## Adaptive difficulty
- state: ${report.difficulty.state}
- reason: ${report.difficulty.reason}
- next scenario seed: ${report.difficulty.nextScenarioSeed || 'none'}

## Trend and regression
- status: ${report.trend.status}
- rule: ${report.trend.regressionRule}
- summary: ${report.trend.summary}
- average score delta: ${report.trend.averageScoreDelta ?? 'n/a'}
- weakest scenario delta: ${report.trend.weakestScenarioDelta.label ? `${report.trend.weakestScenarioDelta.label} ${report.trend.weakestScenarioDelta.delta ?? 'n/a'}` : 'n/a'}
- omission hot-segment delta: ${report.trend.omissionPressureDelta.delta ?? 'n/a'}`
}

function renderTrendMarkdown(trend: ReturnType<typeof buildTrendSignal>) {
    const history = trend.historyWindow
        .map((entry) => `- ${entry.generatedAt}: average=${entry.averageScore} weakest=${entry.weakestScenario} omitted_hot_segments=${entry.omittedHotSegments}`)
        .join('\n') || 'none'
    return `# Orchestration Benchmark Trend

Updated: ${trend.latestGeneratedAt.slice(0, 10)}

## Summary
- status: ${trend.status}
- regression rule: ${trend.regressionRule}
- summary: ${trend.summary}
- compared runs: ${trend.comparedRunCount}
- previous run: ${trend.previousGeneratedAt || 'none'}
- average score delta: ${trend.averageScoreDelta ?? 'n/a'}
- weakest scenario delta: ${trend.weakestScenarioDelta.label ? `${trend.weakestScenarioDelta.label} ${trend.weakestScenarioDelta.delta ?? 'n/a'}` : 'n/a'}
- omission hot-segment delta: ${trend.omissionPressureDelta.delta ?? 'n/a'}

## Regression signals
${trend.regressionSignals.map((entry) => `- ${entry}`).join('\n') || '- none'}

## Improvement signals
${trend.improvementSignals.map((entry) => `- ${entry}`).join('\n') || '- none'}

## Recent history
${history}`
}

function renderDraftPacketMarkdown(draft: ReturnType<typeof buildDraftPackets>[number]) {
    return `---
claimed_by:
status: draft
last_updated: ${generatedAt.slice(0, 10)}
---

# Draft Packet ${draft.suggestedPacket}: ${draft.title}

## Objective
${draft.objective}

## Why this matters
${draft.rationale}

## Benchmark evidence
${draft.benchmarkEvidence}

## Suggested priority
- rank: ${draft.priority}
- score: ${draft.priorityScore}
- severity: ${draft.severity}

## Acceptance criteria
${draft.acceptance.map((item) => `- ${item}`).join('\n')}

## Promotion rule
Promote this draft into \`agents/work-packets/\` only after checking the current canonical packet index and resolving any number collision.`
}

function renderDraftPriorityMarkdown(draftPackets: ReturnType<typeof buildDraftPackets>) {
    return `# Benchmark Draft Packet Priority Queue

Updated: ${generatedAt.slice(0, 10)}

${draftPackets.map((draft) => `- ${draft.priority}. packet ${draft.suggestedPacket}: ${draft.title} (${draft.severity}, score ${draft.priorityScore})`).join('\n')}`
}

function titleCase(value: string) {
    return value
        .split(/\s+/)
        .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
        .join(' ')
}

async function readPreviousBenchmark(filePath: string) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8')) as {
            average_score?: number
            failing_scenarios?: number
            warning_scenarios?: number
        }
    } catch {
        return null
    }
}

async function readBenchmarkHistory(dir: string) {
    const entries = await fs.readdir(dir).catch(() => [])
    const files = entries
        .filter((name) => /^benchmark-\d{4}-\d{2}-\d{2}T.+\.json$/.test(name))
        .sort()
        .slice(-5)
    const reports = []
    for (const name of files) {
        try {
            reports.push(JSON.parse(await fs.readFile(path.join(dir, name), 'utf8')) as {
                generated_at?: string
                average_score?: number
                weakest_scenario?: { id?: string; label?: string; score?: number } | null
                scenario_results?: Array<{
                    id?: string
                    label?: string
                    score?: number
                    metrics?: {
                        omittedHotSegments?: number
                    }
                }>
                failing_scenarios?: number
                warning_scenarios?: number
            })
        } catch {
            continue
        }
    }
    return reports
}

function buildTrendSignal({
    generatedAt,
    history,
    averageScore,
    scenarioResults,
    weakestScenario,
}: {
    generatedAt: string
    history: Awaited<ReturnType<typeof readBenchmarkHistory>>
    averageScore: number
    scenarioResults: Array<{
        id: string
        label: string
        score: number
        metrics: {
            omittedHotSegments: number
        }
    }>
    weakestScenario?: { id: string; label: string; score: number } | null
}) {
    const previous = history.at(-1) || null
    const currentOmittedHotSegments = scenarioResults.reduce((sum, entry) => sum + Number(entry.metrics.omittedHotSegments || 0), 0)
    const previousOmittedHotSegments = previous
        ? sumOmittedHotSegments(previous.scenario_results || [])
        : null
    const previousComparableWeakest = previous && weakestScenario
        ? (previous.scenario_results || []).find((entry) => entry.id === weakestScenario.id) || null
        : null
    const weakestScenarioDelta = weakestScenario
        ? {
            id: weakestScenario.id,
            label: weakestScenario.label,
            currentScore: weakestScenario.score,
            previousScore: typeof previousComparableWeakest?.score === 'number' ? previousComparableWeakest.score : null,
            delta: typeof previousComparableWeakest?.score === 'number'
                ? weakestScenario.score - previousComparableWeakest.score
                : null,
        }
        : {
            id: null,
            label: null,
            currentScore: null,
            previousScore: null,
            delta: null,
        }
    const averageScoreDelta = previous && typeof previous.average_score === 'number'
        ? averageScore - previous.average_score
        : null
    const omissionDelta = previousOmittedHotSegments === null
        ? null
        : currentOmittedHotSegments - previousOmittedHotSegments

    const regressionSignals: string[] = []
    const improvementSignals: string[] = []

    if (weakestScenarioDelta.delta !== null && weakestScenarioDelta.delta <= -2) {
        regressionSignals.push(`Weakest scenario ${weakestScenarioDelta.label} dropped by ${Math.abs(weakestScenarioDelta.delta)} points.`)
    } else if (weakestScenarioDelta.delta !== null && weakestScenarioDelta.delta >= 2) {
        improvementSignals.push(`Weakest scenario ${weakestScenarioDelta.label} improved by ${weakestScenarioDelta.delta} points.`)
    }

    if (omissionDelta !== null && omissionDelta > 0) {
        regressionSignals.push(`Hot-segment omission increased by ${omissionDelta}.`)
    } else if (omissionDelta !== null && omissionDelta < 0) {
        improvementSignals.push(`Hot-segment omission decreased by ${Math.abs(omissionDelta)}.`)
    }

    if (previous) {
        const currentFailures = scenarioResults.filter((entry) => entry.score < 75).length
        const previousFailures = Number(previous.failing_scenarios || 0)
        const currentWarnings = scenarioResults.filter((entry) => entry.score >= 75 && entry.score < 90).length
        const previousWarnings = Number(previous.warning_scenarios || 0)
        if (currentFailures > previousFailures) {
            regressionSignals.push(`Failing scenarios increased from ${previousFailures} to ${currentFailures}.`)
        } else if (currentFailures < previousFailures) {
            improvementSignals.push(`Failing scenarios decreased from ${previousFailures} to ${currentFailures}.`)
        }
        if (currentWarnings > previousWarnings) {
            regressionSignals.push(`Warning scenarios increased from ${previousWarnings} to ${currentWarnings}.`)
        } else if (currentWarnings < previousWarnings) {
            improvementSignals.push(`Warning scenarios decreased from ${previousWarnings} to ${currentWarnings}.`)
        }
    }

    const status = !previous
        ? 'no_history'
        : regressionSignals.length > 0
            ? 'regressed'
            : improvementSignals.length > 0
                ? 'improved'
                : 'stable'
    const summary = !previous
        ? 'No prior benchmark history is available yet, so the current run becomes the regression baseline.'
        : regressionSignals.length > 0
            ? regressionSignals[0]
            : improvementSignals.length > 0
                ? improvementSignals[0]
                : 'No regression detected across the current weakest-scenario and omission-pressure checks.'

    return {
        status,
        regressionRule: 'Flag a regression if the weakest comparable scenario drops by 2+ points or hot-segment omission increases versus the previous run.',
        summary,
        comparedRunCount: history.length + 1,
        latestGeneratedAt: generatedAt,
        previousGeneratedAt: previous?.generated_at || null,
        averageScoreDelta,
        weakestScenarioDelta,
        omissionPressureDelta: {
            currentOmittedHotSegments,
            previousOmittedHotSegments,
            delta: omissionDelta,
        },
        regressionSignals,
        improvementSignals,
        historyWindow: [...history, {
            generated_at: generatedAt,
            average_score: averageScore,
            weakest_scenario: weakestScenario
                ? { label: weakestScenario.label }
                : null,
            scenario_results: scenarioResults,
        }].slice(-5).map((entry) => ({
            generatedAt: String(entry.generated_at || '').slice(0, 19),
            averageScore: Number(entry.average_score || 0),
            weakestScenario: entry.weakest_scenario?.label || 'none',
            omittedHotSegments: sumOmittedHotSegments(entry.scenario_results || []),
        })),
    }
}

function sumOmittedHotSegments(entries: Array<{ metrics?: { omittedHotSegments?: number } }>) {
    return entries.reduce((sum, entry) => sum + Number(entry.metrics?.omittedHotSegments || 0), 0)
}

function deriveDifficultyProfile(previousReport: null | {
    average_score?: number
    failing_scenarios?: number
    warning_scenarios?: number
}) {
    const previousAverageScore = typeof previousReport?.average_score === 'number' ? previousReport.average_score : null
    const previousFails = Number(previousReport?.failing_scenarios || 0)
    const previousWarns = Number(previousReport?.warning_scenarios || 0)
    const shouldEscalate = previousAverageScore !== null && previousAverageScore >= 98 && previousFails === 0

    return {
        level: shouldEscalate ? 2 : 1,
        trigger: shouldEscalate
            ? `previous benchmark saturated at ${previousAverageScore} with ${previousWarns} warnings`
            : 'baseline benchmark difficulty',
        repeatMultiplier: shouldEscalate ? 1.35 : 1,
        adaptiveScenarioEnabled: shouldEscalate,
        previousAverageScore,
    }
}

async function fileExists(filePath: string) {
    try {
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}
