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

type BenchmarkProfileIdentity = {
    tag: string
    source: string
    model: string | null
    endpoint: string | null
    machine: {
        hostname: string
        platform: string
        arch: string
        cpuCount: number
        totalMemoryGb: number
    }
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
const latestProfileComparisonJsonPath = path.join(outputDir, 'benchmark-profile-comparison-latest.json')
const latestProfileComparisonMdPath = path.join(outputDir, 'benchmark-profile-comparison-latest.md')
const latestProfileBaselinesJsonPath = path.join(outputDir, 'benchmark-profile-baselines-latest.json')
const latestProfileBaselinesMdPath = path.join(outputDir, 'benchmark-profile-baselines-latest.md')
const latestScenarioCostsJsonPath = path.join(outputDir, 'benchmark-scenario-costs-latest.json')
const latestScenarioCostsMdPath = path.join(outputDir, 'benchmark-scenario-costs-latest.md')
const latestPacketSelectionJsonPath = path.join(outputDir, 'benchmark-packet-selection-latest.json')
const latestPacketSelectionMdPath = path.join(outputDir, 'benchmark-packet-selection-latest.md')
const latestEvidenceBundleJsonPath = path.join(outputDir, 'benchmark-self-edit-evidence-bundle-latest.json')
const latestEvidenceBundleMdPath = path.join(outputDir, 'benchmark-self-edit-evidence-bundle-latest.md')
const latestFailureClustersJsonPath = path.join(outputDir, 'benchmark-failure-clusters-latest.json')
const latestFailureClustersMdPath = path.join(outputDir, 'benchmark-failure-clusters-latest.md')
const latestRootCauseShortlistJsonPath = path.join(outputDir, 'benchmark-root-cause-shortlist-latest.json')
const latestRootCauseShortlistMdPath = path.join(outputDir, 'benchmark-root-cause-shortlist-latest.md')
const latestSelfImprovementCandidateJsonPath = path.join(outputDir, 'benchmark-self-improvement-candidate-latest.json')
const latestSelfImprovementCandidateMdPath = path.join(outputDir, 'benchmark-self-improvement-candidate-latest.md')
const latestSelfImprovementReleaseCandidateJsonPath = path.join(outputDir, 'benchmark-self-improvement-release-candidate-latest.json')
const latestSelfImprovementReleaseCandidateMdPath = path.join(outputDir, 'benchmark-self-improvement-release-candidate-latest.md')
const latestSelfImprovementReplayInspectionJsonPath = path.join(outputDir, 'benchmark-self-improvement-replay-inspection-latest.json')
const latestSelfImprovementReplayInspectionMdPath = path.join(outputDir, 'benchmark-self-improvement-replay-inspection-latest.md')
const selfImprovementReviewDir = path.join(outputDir, 'self-improvement-reviews')
const warmupArtifactPath = path.join(repoRoot, 'gpt', 'api', 'runtime', 'self-improvement', 'mac-validation-profile-smoke-latest.json')
const profileIdentity = buildBenchmarkProfileIdentity()

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
    const cost = buildScenarioCost({ payload, run })

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
        cost,
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
const warmupContext = await readWarmupContext(warmupArtifactPath)
const scenarioCostReport = buildScenarioCostReport({
    generatedAt,
    profileIdentity,
    warmupContext,
    scenarioResults,
})
const trend = buildTrendSignal({
    generatedAt,
    history: benchmarkHistory,
    profileIdentity,
    averageScore,
    scenarioResults,
    weakestScenario,
})
const recommendations = buildRecommendations({ averageScore, scenarioResults })
const draftPackets = buildDraftPackets({ generatedAt, recommendations, weakestScenario })
const difficulty = buildDifficultySignal({ averageScore, scenarioResults })
const packetSelection = buildPacketSelection({
    generatedAt,
    scenarioCostReport,
    trend,
    difficulty,
    recommendations,
})
const evidenceBundle = buildSelfEditEvidenceBundle({
    generatedAt,
    packetSelection,
    scenarioCostReport,
    trend,
    difficulty,
})
const failureClusters = buildFailureClusters({
    generatedAt,
    profileIdentity,
    history: benchmarkHistory,
    currentReport: {
        generated_at: generatedAt,
        suite: 'orchestration_benchmark_v2',
        profile_identity: profileIdentity,
        scenario_results: scenarioResults,
        trend,
    },
    evidenceBundle,
})
const rootCauseShortlist = buildRootCauseShortlist({
    generatedAt,
    failureClusters,
    evidenceBundle,
    scenarioCostReport,
    trend,
})
const selfImprovementReviews = await readSelfImprovementReviews(selfImprovementReviewDir)
const selfImprovementCandidate = buildSelfImprovementCandidate({
    generatedAt,
    rootCauseShortlist,
    evidenceBundle,
    packetSelection,
    scenarioCostReport,
    trend,
    reviews: selfImprovementReviews,
})
const selfImprovementReleaseCandidate = buildSelfImprovementReleaseCandidate({
    generatedAt,
    selfImprovementCandidate,
    evidenceBundle,
    rootCauseShortlist,
    scenarioCostReport,
    reviews: selfImprovementReviews,
})
const selfImprovementReplayInspection = await buildSelfImprovementReplayInspection({
    generatedAt,
    selfImprovementCandidate,
    selfImprovementReleaseCandidate,
    scenarioResults,
})
const report = {
    generated_at: generatedAt,
    suite: 'orchestration_benchmark_v2',
    profile_identity: profileIdentity,
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
    scenario_costs: scenarioCostReport,
    packet_selection: packetSelection,
    self_edit_evidence_bundle: evidenceBundle,
    failure_clusters: failureClusters,
    root_cause_shortlist: rootCauseShortlist,
    self_improvement_candidate: selfImprovementCandidate,
    self_improvement_release_candidate: selfImprovementReleaseCandidate,
    self_improvement_replay_inspection: selfImprovementReplayInspection,
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
await fs.writeFile(latestScenarioCostsJsonPath, `${JSON.stringify(scenarioCostReport, null, 2)}\n`, 'utf8')
await fs.writeFile(latestScenarioCostsMdPath, `${renderScenarioCostsMarkdown(scenarioCostReport)}\n`, 'utf8')
await fs.writeFile(latestPacketSelectionJsonPath, `${JSON.stringify(packetSelection, null, 2)}\n`, 'utf8')
await fs.writeFile(latestPacketSelectionMdPath, `${renderPacketSelectionMarkdown(packetSelection)}\n`, 'utf8')
await fs.writeFile(latestEvidenceBundleJsonPath, `${JSON.stringify(evidenceBundle, null, 2)}\n`, 'utf8')
await fs.writeFile(latestEvidenceBundleMdPath, `${renderSelfEditEvidenceBundleMarkdown(evidenceBundle)}\n`, 'utf8')
await fs.writeFile(latestFailureClustersJsonPath, `${JSON.stringify(failureClusters, null, 2)}\n`, 'utf8')
await fs.writeFile(latestFailureClustersMdPath, `${renderFailureClustersMarkdown(failureClusters)}\n`, 'utf8')
await fs.writeFile(latestRootCauseShortlistJsonPath, `${JSON.stringify(rootCauseShortlist, null, 2)}\n`, 'utf8')
await fs.writeFile(latestRootCauseShortlistMdPath, `${renderRootCauseShortlistMarkdown(rootCauseShortlist)}\n`, 'utf8')
await fs.writeFile(latestSelfImprovementCandidateJsonPath, `${JSON.stringify(selfImprovementCandidate, null, 2)}\n`, 'utf8')
await fs.writeFile(latestSelfImprovementCandidateMdPath, `${renderSelfImprovementCandidateMarkdown(selfImprovementCandidate)}\n`, 'utf8')
await fs.writeFile(latestSelfImprovementReleaseCandidateJsonPath, `${JSON.stringify(selfImprovementReleaseCandidate, null, 2)}\n`, 'utf8')
await fs.writeFile(latestSelfImprovementReleaseCandidateMdPath, `${renderSelfImprovementReleaseCandidateMarkdown(selfImprovementReleaseCandidate)}\n`, 'utf8')
await fs.writeFile(latestSelfImprovementReplayInspectionJsonPath, `${JSON.stringify(selfImprovementReplayInspection, null, 2)}\n`, 'utf8')
await fs.writeFile(latestSelfImprovementReplayInspectionMdPath, `${renderSelfImprovementReplayInspectionMarkdown(selfImprovementReplayInspection)}\n`, 'utf8')
const profileBaselines = buildProfileBaselines({
    generatedAt,
    currentReport: report,
    history: benchmarkHistory,
})
const profileComparison = buildProfileComparison({
    generatedAt,
    currentReport: report,
    history: benchmarkHistory,
})
await fs.writeFile(latestProfileBaselinesJsonPath, `${JSON.stringify(profileBaselines, null, 2)}\n`, 'utf8')
await fs.writeFile(latestProfileBaselinesMdPath, `${renderProfileBaselinesMarkdown(profileBaselines)}\n`, 'utf8')
await fs.writeFile(latestProfileComparisonJsonPath, `${JSON.stringify(profileComparison, null, 2)}\n`, 'utf8')
await fs.writeFile(latestProfileComparisonMdPath, `${renderProfileComparisonMarkdown(profileComparison)}\n`, 'utf8')
await writeDraftPackets(draftPackets)

console.log(JSON.stringify({
    ok: true,
    averageScore,
    latestJsonPath,
    latestMdPath,
    latestTrendJsonPath,
    latestTrendMdPath,
    latestProfileBaselinesJsonPath,
    latestProfileBaselinesMdPath,
    latestProfileComparisonJsonPath,
    latestProfileComparisonMdPath,
    latestScenarioCostsJsonPath,
    latestScenarioCostsMdPath,
    latestPacketSelectionJsonPath,
    latestPacketSelectionMdPath,
    latestEvidenceBundleJsonPath,
    latestEvidenceBundleMdPath,
    latestFailureClustersJsonPath,
    latestFailureClustersMdPath,
    latestRootCauseShortlistJsonPath,
    latestRootCauseShortlistMdPath,
    latestSelfImprovementCandidateJsonPath,
    latestSelfImprovementCandidateMdPath,
    latestSelfImprovementReleaseCandidateJsonPath,
    latestSelfImprovementReleaseCandidateMdPath,
    latestSelfImprovementReplayInspectionJsonPath,
    latestSelfImprovementReplayInspectionMdPath,
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
        const startedAt = Date.now()
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

        const parsed = JSON.parse(output) as {
            ok: boolean
            runId: string
            replayPath: string
        }
        return {
            ...parsed,
            wallMs: Date.now() - startedAt,
        }
    } finally {
        await fs.unlink(scenarioFilePath).catch(() => {})
    }
}

type ScenarioCost = {
    wallMs: number
    nodeActiveMs: number
    packedTokens: number
    omittedTokens: number
    totalContextTokens: number
    contextPackCount: number
    eventCount: number
    artifactCount: number
    artifactBytes: number
    costScore: number
    dominantCost: string
}

function buildScenarioCost({
    payload,
    run,
}: {
    payload: { wallMs?: number }
    run: Awaited<ReturnType<typeof readRun>>
}): ScenarioCost {
    const packedTokens = run.context.packs.reduce((sum, pack) => sum + pack.usedTokens, 0)
    const omittedTokens = run.context.packs.reduce((sum, pack) => sum + pack.omitted.reduce((inner, segment) => inner + segment.estimatedTokens, 0), 0)
    const artifactBytes = run.events.reduce((sum, event) => sum + event.artifacts.reduce((inner, artifact) => inner + Buffer.byteLength(artifact.content || '', 'utf8'), 0), 0)
    const nodeActiveMs = run.nodes.reduce((sum, node) => {
        if (!node.startedAt || !node.completedAt) return sum
        return sum + Math.max(0, Date.parse(node.completedAt) - Date.parse(node.startedAt))
    }, 0)
    const wallMs = Math.max(0, Number(payload.wallMs || 0))
    const eventCount = run.events.length
    const artifactCount = run.events.reduce((total, event) => total + event.artifacts.length, 0)
    const tokenCost = Math.round((packedTokens + omittedTokens * 0.35) / 100)
    const activityCost = Math.round(nodeActiveMs / 25)
    const eventCost = eventCount * 2 + artifactCount * 3
    const wallCost = Math.round(wallMs / 20)
    const artifactCost = Math.round(artifactBytes / 1024)
    const costScore = tokenCost + activityCost + eventCost + wallCost + artifactCost
    const dominantEntries = [
        { label: 'context', value: tokenCost },
        { label: 'node_time', value: activityCost },
        { label: 'events', value: eventCost },
        { label: 'wall_time', value: wallCost },
        { label: 'artifacts', value: artifactCost },
    ].sort((left, right) => right.value - left.value)

    return {
        wallMs,
        nodeActiveMs,
        packedTokens,
        omittedTokens,
        totalContextTokens: packedTokens + omittedTokens,
        contextPackCount: run.context.packs.length,
        eventCount,
        artifactCount,
        artifactBytes,
        costScore,
        dominantCost: `${dominantEntries[0]?.label || 'unknown'}:${dominantEntries[0]?.value || 0}`,
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
    profile_identity: BenchmarkProfileIdentity
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
        id: string
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
        cost: ScenarioCost
    }>
    scenario_costs: ReturnType<typeof buildScenarioCostReport>
    packet_selection: ReturnType<typeof buildPacketSelection>
    self_edit_evidence_bundle: ReturnType<typeof buildSelfEditEvidenceBundle>
    failure_clusters: ReturnType<typeof buildFailureClusters>
    root_cause_shortlist: ReturnType<typeof buildRootCauseShortlist>
    self_improvement_candidate: ReturnType<typeof buildSelfImprovementCandidate>
    self_improvement_release_candidate: ReturnType<typeof buildSelfImprovementReleaseCandidate>
    self_improvement_replay_inspection: Awaited<ReturnType<typeof buildSelfImprovementReplayInspection>>
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
        profileTag: string
        baselineStatus: string
        baselineGeneratedAt: string | null
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
- profile: ${report.profile_identity.tag}
- profile source: ${report.profile_identity.source}
- model: ${report.profile_identity.model || 'unspecified'}
- endpoint: ${report.profile_identity.endpoint || 'unspecified'}
- machine: ${report.profile_identity.machine.platform}/${report.profile_identity.machine.arch}, ${report.profile_identity.machine.cpuCount} CPUs, ${report.profile_identity.machine.totalMemoryGb} GB
- difficulty level: ${report.difficulty_profile.level} (${report.difficulty_profile.trigger})
- repeat multiplier: ${report.difficulty_profile.repeatMultiplier}
- adaptive scenario enabled: ${report.difficulty_profile.adaptiveScenarioEnabled ? 'yes' : 'no'}
- average score: ${report.average_score}
- scenarios: ${report.scenario_count}
- pass / warn / fail: ${report.passing_scenarios} / ${report.warning_scenarios} / ${report.failing_scenarios}
- weakest scenario: ${report.weakest_scenario ? `${report.weakest_scenario.label} (${report.weakest_scenario.score})` : 'none'}

## Scenario results
${report.scenario_results.map((entry) => `- ${entry.label}: ${entry.status} (${entry.score}) role=${entry.metrics.roleCoverage.toFixed(2)} pack=${entry.metrics.packCoverage.toFixed(2)} evidence=${entry.metrics.evidenceCoverage.toFixed(2)} export=${entry.metrics.exportGateHealth.toFixed(2)} pressure=${entry.metrics.contextPressureCoverage.toFixed(2)} blocked=${entry.metrics.blockedRoleCoverage.toFixed(2)} contradiction=${entry.metrics.contradictionCoverage.toFixed(2)}`).join('\n')}

## Highest-cost scenarios
${report.scenario_costs.highestCostScenarios.map((entry) => `- ${entry.label}: cost=${entry.costScore} wall=${entry.wallMs}ms packed=${entry.packedTokens} omitted=${entry.omittedTokens} dominant=${entry.dominantCost}`).join('\n') || 'none'}

## Evidence-ranked packet selection
${report.packet_selection.rankedPackets.map((entry) => `- packet ${entry.packet}: ${entry.title} score=${entry.score} confidence=${entry.confidence} evidence=${entry.evidence.join('; ')}`).join('\n') || 'none'}

## Self-edit evidence bundle
- id: ${report.self_edit_evidence_bundle.id}
- packet: ${report.self_edit_evidence_bundle.selectedPacket.packet}
- status: ${report.self_edit_evidence_bundle.status}
- primary evidence: ${report.self_edit_evidence_bundle.primaryEvidence.map((entry) => entry.summary).join('; ')}

## Failure clusters
${report.failure_clusters.clusters.slice(0, 5).map((entry) => `- ${entry.key}: count=${entry.count} latest=${entry.latestGeneratedAt} severity=${entry.severity} examples=${entry.examples.join('; ')}`).join('\n') || '- none'}

## Root-cause shortlist
${report.root_cause_shortlist.candidates.map((entry) => `- ${entry.rank}. ${entry.cause}: score=${entry.score} confidence=${entry.confidence} evidence=${entry.evidence.join('; ')}`).join('\n') || '- none'}

## Verified self-improvement candidate
- status: ${report.self_improvement_candidate.status}
- id: ${report.self_improvement_candidate.candidate?.id || 'none'}
- confidence: ${report.self_improvement_candidate.candidate?.confidence || 'n/a'}
- next action: ${report.self_improvement_candidate.candidate?.nextAction || report.self_improvement_candidate.stoppingRule}

## Self-improvement release candidate
- status: ${report.self_improvement_release_candidate.status}
- id: ${report.self_improvement_release_candidate.releaseCandidate?.id || 'none'}
- review owner: ${report.self_improvement_release_candidate.reviewPath.humanReviewPoint}
- outcome: ${report.self_improvement_release_candidate.currentOutcome.state}

## Self-improvement replay inspection
- status: ${report.self_improvement_replay_inspection.status}
- target: ${report.self_improvement_replay_inspection.targetScenario?.label || 'none'}
- recommendation: ${report.self_improvement_replay_inspection.recommendation}
- omitted hot segments: ${report.self_improvement_replay_inspection.contextPressure?.omittedHotSegments ?? 'n/a'}

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
- profile: ${report.trend.profileTag}
- baseline: ${report.trend.baselineStatus}${report.trend.baselineGeneratedAt ? ` (${report.trend.baselineGeneratedAt})` : ''}
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
- profile: ${trend.profileTag}
- baseline: ${trend.baselineStatus}${trend.baselineGeneratedAt ? ` (${trend.baselineGeneratedAt})` : ''}
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
                profile_identity?: BenchmarkProfileIdentity
                average_score?: number
                scenario_count?: number
                weakest_scenario?: { id?: string; label?: string; score?: number } | null
                scenario_results?: Array<{
                    id?: string
                    label?: string
                    status?: string
                    score?: number
                    failedGates?: string[]
                    warningGates?: string[]
                    metrics?: {
                        omittedHotSegments?: number
                    }
                }>
                failing_scenarios?: number
                warning_scenarios?: number
                trend?: {
                    regressionSignals?: string[]
                }
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
    profileIdentity,
    averageScore,
    scenarioResults,
    weakestScenario,
}: {
    generatedAt: string
    history: Awaited<ReturnType<typeof readBenchmarkHistory>>
    profileIdentity: BenchmarkProfileIdentity
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
    const profileTag = profileIdentity.tag || 'unspecified'
    const sameProfileHistory = history.filter((entry) => (entry.profile_identity?.tag || 'unspecified') === profileTag)
    const previous = sameProfileHistory.at(-1) || null
    const nearestCrossProfile = history.at(-1) || null
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
        ? 'no_profile_baseline'
        : regressionSignals.length > 0
            ? 'regressed'
            : improvementSignals.length > 0
                ? 'improved'
                : 'stable'
    const summary = !previous
        ? nearestCrossProfile
            ? `No previous ${profileTag} baseline exists. The nearest run used ${(nearestCrossProfile.profile_identity?.tag || 'unspecified')}, so regression comparison is intentionally withheld.`
            : `No prior benchmark history exists for ${profileTag}, so this run becomes the first profile baseline.`
        : regressionSignals.length > 0
            ? regressionSignals[0]
            : improvementSignals.length > 0
                ? improvementSignals[0]
                : 'No regression detected across the current weakest-scenario and omission-pressure checks.'

    return {
        status,
        profileTag,
        baselineStatus: previous ? 'matched_profile_baseline' : 'missing_profile_baseline',
        baselineGeneratedAt: previous?.generated_at || null,
        crossProfileCandidate: !previous && nearestCrossProfile
            ? {
                generatedAt: nearestCrossProfile.generated_at || null,
                profileTag: nearestCrossProfile.profile_identity?.tag || 'unspecified',
                averageScore: nearestCrossProfile.average_score ?? null,
            }
            : null,
        regressionRule: 'Compare regressions only against the previous benchmark with the same profile tag; withhold regression status when only cross-profile history exists.',
        summary,
        comparedRunCount: sameProfileHistory.length + 1,
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
            profile_identity: profileIdentity,
            average_score: averageScore,
            weakest_scenario: weakestScenario
                ? { label: weakestScenario.label }
                : null,
            scenario_results: scenarioResults,
        }].slice(-5).map((entry) => ({
            generatedAt: String(entry.generated_at || '').slice(0, 19),
            profile: entry.profile_identity?.tag || 'unspecified',
            averageScore: Number(entry.average_score || 0),
            weakestScenario: entry.weakest_scenario?.label || 'none',
            omittedHotSegments: sumOmittedHotSegments(entry.scenario_results || []),
        })),
    }
}

async function readWarmupContext(filePath: string) {
    try {
        const artifact = JSON.parse(await fs.readFile(filePath, 'utf8')) as {
            generated_at?: string
            profile_tag?: string
            baseline_key?: string
            ok?: boolean
            warmup?: {
                status?: string
                total_ms?: number
                probes?: {
                    props_ms?: number
                    slots_ms?: number
                }
                memory_after?: {
                    pressure?: number
                    used_gb?: number
                    free_gb?: number
                }
                memory_delta?: {
                    used_gb?: number
                    pressure?: number
                }
            }
        }
        return {
            generatedAt: artifact.generated_at || null,
            profileTag: artifact.profile_tag || null,
            baselineKey: artifact.baseline_key || null,
            ok: Boolean(artifact.ok),
            status: artifact.warmup?.status || 'unknown',
            totalMs: artifact.warmup?.total_ms ?? null,
            propsMs: artifact.warmup?.probes?.props_ms ?? null,
            slotsMs: artifact.warmup?.probes?.slots_ms ?? null,
            memoryPressure: artifact.warmup?.memory_after?.pressure ?? null,
            memoryUsedGb: artifact.warmup?.memory_after?.used_gb ?? null,
            memoryFreeGb: artifact.warmup?.memory_after?.free_gb ?? null,
            memoryDeltaUsedGb: artifact.warmup?.memory_delta?.used_gb ?? null,
            memoryDeltaPressure: artifact.warmup?.memory_delta?.pressure ?? null,
        }
    } catch {
        return {
            generatedAt: null,
            profileTag: null,
            baselineKey: null,
            ok: false,
            status: 'missing',
            totalMs: null,
            propsMs: null,
            slotsMs: null,
            memoryPressure: null,
            memoryUsedGb: null,
            memoryFreeGb: null,
            memoryDeltaUsedGb: null,
            memoryDeltaPressure: null,
        }
    }
}

function buildScenarioCostReport({
    generatedAt,
    profileIdentity,
    warmupContext,
    scenarioResults,
}: {
    generatedAt: string
    profileIdentity: BenchmarkProfileIdentity
    warmupContext: Awaited<ReturnType<typeof readWarmupContext>>
    scenarioResults: Array<{
        id: string
        label: string
        score: number
        status: string
        cost: ScenarioCost
    }>
}) {
    const totalCostScore = scenarioResults.reduce((sum, entry) => sum + entry.cost.costScore, 0)
    const highestCostScenarios = scenarioResults
        .map((entry) => ({
            id: entry.id,
            label: entry.label,
            status: entry.status,
            score: entry.score,
            ...entry.cost,
            costShare: totalCostScore > 0 ? Number((entry.cost.costScore / totalCostScore).toFixed(4)) : 0,
        }))
        .sort((left, right) => right.costScore - left.costScore || right.wallMs - left.wallMs)

    return {
        generated_at: generatedAt,
        benchmark_family: 'orchestration_benchmark_v2',
        profile_identity: profileIdentity,
        warmup_context: warmupContext,
        totals: {
            scenario_count: scenarioResults.length,
            cost_score: totalCostScore,
            wall_ms: scenarioResults.reduce((sum, entry) => sum + entry.cost.wallMs, 0),
            node_active_ms: scenarioResults.reduce((sum, entry) => sum + entry.cost.nodeActiveMs, 0),
            packed_tokens: scenarioResults.reduce((sum, entry) => sum + entry.cost.packedTokens, 0),
            omitted_tokens: scenarioResults.reduce((sum, entry) => sum + entry.cost.omittedTokens, 0),
            artifact_bytes: scenarioResults.reduce((sum, entry) => sum + entry.cost.artifactBytes, 0),
        },
        highestCostScenarios,
        missingInputs: [
            'No real model prompt/completion token usage is available for these demo workers.',
            'Wall time includes child process and filesystem overhead, not only worker reasoning.',
            'Warmup context is read from the latest Mac validation smoke artifact and may predate this benchmark run.',
        ],
    }
}

function renderScenarioCostsMarkdown(report: ReturnType<typeof buildScenarioCostReport>) {
    return `# Benchmark Scenario Costs

Updated: ${report.generated_at.slice(0, 10)}

## Context
- profile: ${report.profile_identity.tag}
- warmup baseline: ${report.warmup_context.baselineKey || 'missing'}
- warmup status: ${report.warmup_context.status}
- warmup ms: ${report.warmup_context.totalMs ?? 'n/a'}
- memory pressure: ${report.warmup_context.memoryPressure ?? 'n/a'}

## Totals
- scenarios: ${report.totals.scenario_count}
- cost score: ${report.totals.cost_score}
- wall ms: ${report.totals.wall_ms}
- node active ms: ${report.totals.node_active_ms}
- packed tokens: ${report.totals.packed_tokens}
- omitted tokens: ${report.totals.omitted_tokens}
- artifact bytes: ${report.totals.artifact_bytes}

## Highest-cost scenarios
${report.highestCostScenarios.map((entry) => `- ${entry.label}: cost=${entry.costScore} share=${entry.costShare} wall=${entry.wallMs}ms node=${entry.nodeActiveMs}ms packed=${entry.packedTokens} omitted=${entry.omittedTokens} events=${entry.eventCount} artifacts=${entry.artifactCount} dominant=${entry.dominantCost}`).join('\n') || '- none'}

## Missing inputs
${report.missingInputs.map((entry) => `- ${entry}`).join('\n')}`
}

function buildPacketSelection({
    generatedAt,
    scenarioCostReport,
    trend,
    difficulty,
    recommendations,
}: {
    generatedAt: string
    scenarioCostReport: ReturnType<typeof buildScenarioCostReport>
    trend: ReturnType<typeof buildTrendSignal>
    difficulty: ReturnType<typeof buildDifficultySignal>
    recommendations: ReturnType<typeof buildRecommendations>
}) {
    const topCost = scenarioCostReport.highestCostScenarios[0] || null
    const totalCost = scenarioCostReport.totals.cost_score || 0
    const highCostShare = topCost?.costShare || 0
    const contextDominated = scenarioCostReport.highestCostScenarios.some((entry) => entry.dominantCost.startsWith('context:') && entry.costShare >= 0.15)
    const hasRegression = trend.status === 'regressed'
    const missingProfileBaseline = trend.status === 'no_profile_baseline'
    const wantsMoreDifficulty = difficulty.state === 'increase'
    const hasBenchmarkRecommendations = recommendations.length > 0

    const candidates = [
        {
            packet: 90,
            title: 'Evidence Bundle For Self-Edits',
            score: 40
                + (totalCost > 0 ? 20 : 0)
                + (highCostShare >= 0.2 ? 15 : 0)
                + (contextDominated ? 10 : 0)
                + (hasBenchmarkRecommendations ? 10 : 0),
            confidence: totalCost > 0 ? 'high' : 'medium',
            evidence: [
                `scenario cost score=${totalCost}`,
                topCost ? `top scenario=${topCost.label} share=${topCost.costShare}` : 'no top-cost scenario',
                `warmup baseline=${scenarioCostReport.warmup_context.baselineKey || 'missing'}`,
                'next packet depends directly on ranking evidence',
            ],
        },
        {
            packet: 91,
            title: 'Cross-Machine Profile Normalization',
            score: 20
                + (missingProfileBaseline ? 25 : 0)
                + (scenarioCostReport.profile_identity.machine.hostname ? 10 : 0),
            confidence: missingProfileBaseline ? 'medium' : 'low',
            evidence: [
                `trend status=${trend.status}`,
                `profile=${scenarioCostReport.profile_identity.tag}`,
                `machine=${scenarioCostReport.profile_identity.machine.platform}/${scenarioCostReport.profile_identity.machine.arch}`,
            ],
        },
        {
            packet: 92,
            title: 'Eval Failure Clustering And Dedup',
            score: 15
                + (hasRegression ? 30 : 0)
                + (recommendations.length > 1 ? 10 : 0),
            confidence: hasRegression ? 'medium' : 'low',
            evidence: [
                `regression signals=${trend.regressionSignals.length}`,
                `recommendations=${recommendations.length}`,
            ],
        },
        {
            packet: 93,
            title: 'Regression Root-Cause Shortlisting',
            score: 10
                + (hasRegression ? 35 : 0)
                + (contextDominated ? 10 : 0),
            confidence: hasRegression ? 'medium' : 'low',
            evidence: [
                `trend status=${trend.status}`,
                contextDominated ? 'highest costs are context dominated' : 'highest costs are not context dominated',
            ],
        },
        {
            packet: 94,
            title: 'Verified Self-Improvement Candidate Flow',
            score: 10
                + (wantsMoreDifficulty ? 20 : 0)
                + (totalCost > 0 ? 10 : 0),
            confidence: wantsMoreDifficulty ? 'medium' : 'low',
            evidence: [
                `difficulty=${difficulty.state}`,
                `difficulty reason=${difficulty.reason}`,
            ],
        },
        {
            packet: 95,
            title: 'Reviewed Self-Improvement Release Candidate',
            score: 5,
            confidence: 'low',
            evidence: [
                'release-candidate flow should wait for evidence bundle and candidate generation outputs',
            ],
        },
    ]
        .map((entry) => ({
            ...entry,
            score: Math.max(0, Math.round(entry.score)),
        }))
        .sort((left, right) => right.score - left.score || left.packet - right.packet)

    return {
        generated_at: generatedAt,
        benchmark_family: scenarioCostReport.benchmark_family,
        evidence_inputs: {
            scenario_costs: 'benchmark-scenario-costs-latest.json',
            trend_status: trend.status,
            profile_tag: scenarioCostReport.profile_identity.tag,
            warmup_baseline: scenarioCostReport.warmup_context.baselineKey,
            top_cost_scenario: topCost
                ? {
                    id: topCost.id,
                    label: topCost.label,
                    costScore: topCost.costScore,
                    costShare: topCost.costShare,
                    dominantCost: topCost.dominantCost,
                }
                : null,
        },
        rankedPackets: candidates,
        selectedPacket: candidates[0] || null,
        manualOverrideNotes: [
            'Dependency gates still override the numeric score.',
            'User-directed product work can supersede self-improvement packet ranking.',
            'Low-confidence candidates should not be implemented without reading their packet file.',
        ],
    }
}

function renderPacketSelectionMarkdown(selection: ReturnType<typeof buildPacketSelection>) {
    return `# Benchmark Packet Selection

Updated: ${selection.generated_at.slice(0, 10)}

## Selected
${selection.selectedPacket ? `- packet: ${selection.selectedPacket.packet}\n- title: ${selection.selectedPacket.title}\n- score: ${selection.selectedPacket.score}\n- confidence: ${selection.selectedPacket.confidence}` : '- none'}

## Evidence inputs
- benchmark family: ${selection.benchmark_family}
- trend status: ${selection.evidence_inputs.trend_status}
- profile: ${selection.evidence_inputs.profile_tag}
- warmup baseline: ${selection.evidence_inputs.warmup_baseline || 'missing'}
- top cost scenario: ${selection.evidence_inputs.top_cost_scenario ? `${selection.evidence_inputs.top_cost_scenario.label} (${selection.evidence_inputs.top_cost_scenario.costScore}, ${selection.evidence_inputs.top_cost_scenario.dominantCost})` : 'none'}

## Ranked packets
${selection.rankedPackets.map((entry) => `- packet ${entry.packet}: ${entry.title} score=${entry.score} confidence=${entry.confidence} evidence=${entry.evidence.join(' | ')}`).join('\n')}

## Manual override notes
${selection.manualOverrideNotes.map((entry) => `- ${entry}`).join('\n')}`
}

function buildSelfEditEvidenceBundle({
    generatedAt,
    packetSelection,
    scenarioCostReport,
    trend,
    difficulty,
}: {
    generatedAt: string
    packetSelection: ReturnType<typeof buildPacketSelection>
    scenarioCostReport: ReturnType<typeof buildScenarioCostReport>
    trend: ReturnType<typeof buildTrendSignal>
    difficulty: ReturnType<typeof buildDifficultySignal>
}) {
    const selectedPacket = packetSelection.selectedPacket || {
        packet: 0,
        title: 'No selected packet',
        score: 0,
        confidence: 'low',
        evidence: ['No packet selection was available.'],
    }
    const topScenario = scenarioCostReport.highestCostScenarios[0] || null
    const bundleId = `self-edit-${generatedAt.slice(0, 10)}-packet-${selectedPacket.packet}`
    const primaryEvidence = [
        {
            kind: 'packet_selection',
            summary: `Packet ${selectedPacket.packet} ranked first with score ${selectedPacket.score} and ${selectedPacket.confidence} confidence.`,
            source: 'benchmark-packet-selection-latest.json',
        },
        topScenario
            ? {
                kind: 'scenario_cost',
                summary: `${topScenario.label} is the highest-cost scenario at ${topScenario.costScore} cost score and ${topScenario.costShare} share.`,
                source: 'benchmark-scenario-costs-latest.json',
            }
            : {
                kind: 'scenario_cost',
                summary: 'No scenario cost record was available.',
                source: 'benchmark-scenario-costs-latest.json',
            },
        {
            kind: 'profile_trend',
            summary: `Profile-aware trend is ${trend.status} for ${trend.profileTag}.`,
            source: 'benchmark-trend-latest.json',
        },
        {
            kind: 'warmup',
            summary: `Warmup baseline is ${scenarioCostReport.warmup_context.baselineKey || 'missing'} with status ${scenarioCostReport.warmup_context.status}.`,
            source: 'mac-validation-profile-smoke-latest.json',
        },
    ]

    return {
        id: bundleId,
        generated_at: generatedAt,
        status: selectedPacket.packet > 0 ? 'ready_for_review' : 'no_candidate',
        selectedPacket,
        benchmarkFamily: scenarioCostReport.benchmark_family,
        profileTag: scenarioCostReport.profile_identity.tag,
        primaryEvidence,
        costContext: {
            totalCostScore: scenarioCostReport.totals.cost_score,
            topScenario: topScenario
                ? {
                    id: topScenario.id,
                    label: topScenario.label,
                    costScore: topScenario.costScore,
                    costShare: topScenario.costShare,
                    dominantCost: topScenario.dominantCost,
                    packedTokens: topScenario.packedTokens,
                    omittedTokens: topScenario.omittedTokens,
                }
                : null,
        },
        trendContext: {
            status: trend.status,
            baselineStatus: trend.baselineStatus,
            baselineGeneratedAt: trend.baselineGeneratedAt,
            regressionSignals: trend.regressionSignals,
            improvementSignals: trend.improvementSignals,
        },
        difficultyContext: {
            state: difficulty.state,
            reason: difficulty.reason,
            nextScenarioSeed: difficulty.nextScenarioSeed,
        },
        reviewChecklist: [
            'Confirm the selected packet dependency gate is satisfied.',
            'Read the selected packet file before editing code.',
            'Use the linked benchmark artifacts as evidence, not as automatic approval.',
            'Rerun the benchmark after the self-edit path changes.',
        ],
        artifactLinks: {
            benchmark: 'benchmark-latest.json',
            scenarioCosts: 'benchmark-scenario-costs-latest.json',
            packetSelection: 'benchmark-packet-selection-latest.json',
            trend: 'benchmark-trend-latest.json',
            warmup: 'runtime/self-improvement/mac-validation-profile-smoke-latest.json',
        },
    }
}

function renderSelfEditEvidenceBundleMarkdown(bundle: ReturnType<typeof buildSelfEditEvidenceBundle>) {
    return `# Self-Edit Evidence Bundle

Updated: ${bundle.generated_at.slice(0, 10)}

## Candidate
- id: ${bundle.id}
- status: ${bundle.status}
- packet: ${bundle.selectedPacket.packet}
- title: ${bundle.selectedPacket.title}
- score: ${bundle.selectedPacket.score}
- confidence: ${bundle.selectedPacket.confidence}
- profile: ${bundle.profileTag}

## Primary evidence
${bundle.primaryEvidence.map((entry) => `- ${entry.kind}: ${entry.summary} (${entry.source})`).join('\n')}

## Cost context
- total cost score: ${bundle.costContext.totalCostScore}
- top scenario: ${bundle.costContext.topScenario ? `${bundle.costContext.topScenario.label} (${bundle.costContext.topScenario.costScore}, ${bundle.costContext.topScenario.dominantCost})` : 'none'}
- packed / omitted tokens: ${bundle.costContext.topScenario ? `${bundle.costContext.topScenario.packedTokens} / ${bundle.costContext.topScenario.omittedTokens}` : 'n/a'}

## Trend context
- status: ${bundle.trendContext.status}
- baseline: ${bundle.trendContext.baselineStatus}${bundle.trendContext.baselineGeneratedAt ? ` (${bundle.trendContext.baselineGeneratedAt})` : ''}
- regression signals: ${bundle.trendContext.regressionSignals.length || 0}
- improvement signals: ${bundle.trendContext.improvementSignals.length || 0}

## Difficulty context
- state: ${bundle.difficultyContext.state}
- reason: ${bundle.difficultyContext.reason}
- next seed: ${bundle.difficultyContext.nextScenarioSeed || 'none'}

## Review checklist
${bundle.reviewChecklist.map((entry) => `- ${entry}`).join('\n')}`
}

function buildFailureClusters({
    generatedAt,
    profileIdentity,
    history,
    currentReport,
    evidenceBundle,
}: {
    generatedAt: string
    profileIdentity: BenchmarkProfileIdentity
    history: Awaited<ReturnType<typeof readBenchmarkHistory>>
    currentReport: {
        generated_at: string
        suite: string
        profile_identity: BenchmarkProfileIdentity
        scenario_results: Array<{
            id: string
            label: string
            status: string
            score: number
            failedGates: string[]
            warningGates: string[]
        }>
        trend: ReturnType<typeof buildTrendSignal>
    }
    evidenceBundle: ReturnType<typeof buildSelfEditEvidenceBundle>
}) {
    const reports = [...history, currentReport]
    const clusters = new Map<string, {
        key: string
        kind: 'gate' | 'scenario_status' | 'regression_signal'
        profileTag: string
        machineKey: string
        severity: 'warning' | 'failure' | 'regression'
        count: number
        latestGeneratedAt: string
        firstGeneratedAt: string
        examples: string[]
        sourceRuns: string[]
        evidenceBundleId: string
    }>()

    for (const report of reports) {
        const identity = report.profile_identity || profileIdentity
        const profileTag = identity.tag || 'unspecified'
        const machineKey = machineComparisonKey(identity)
        const generatedAtValue = String(report.generated_at || '')
        for (const scenario of report.scenario_results || []) {
            if (scenario.status && scenario.status !== 'pass') {
                addCluster({
                    clusters,
                    key: `scenario_status:${profileTag}:${machineKey}:${scenario.id}:${scenario.status}`,
                    kind: 'scenario_status',
                    profileTag,
                    machineKey,
                    severity: scenario.status === 'fail' ? 'failure' : 'warning',
                    generatedAt: generatedAtValue,
                    example: `${scenario.label} status=${scenario.status} score=${scenario.score}`,
                    evidenceBundleId: evidenceBundle.id,
                })
            }
            for (const gate of scenario.failedGates || []) {
                addCluster({
                    clusters,
                    key: `gate:${profileTag}:${machineKey}:${scenario.id}:${gate}:fail`,
                    kind: 'gate',
                    profileTag,
                    machineKey,
                    severity: 'failure',
                    generatedAt: generatedAtValue,
                    example: `${scenario.label} failed gate ${gate}`,
                    evidenceBundleId: evidenceBundle.id,
                })
            }
            for (const gate of scenario.warningGates || []) {
                addCluster({
                    clusters,
                    key: `gate:${profileTag}:${machineKey}:${scenario.id}:${gate}:warn`,
                    kind: 'gate',
                    profileTag,
                    machineKey,
                    severity: 'warning',
                    generatedAt: generatedAtValue,
                    example: `${scenario.label} warned gate ${gate}`,
                    evidenceBundleId: evidenceBundle.id,
                })
            }
        }
        for (const signal of report.trend?.regressionSignals || []) {
            addCluster({
                clusters,
                key: `regression_signal:${profileTag}:${machineKey}:${slugForCluster(signal)}`,
                kind: 'regression_signal',
                profileTag,
                machineKey,
                severity: 'regression',
                generatedAt: generatedAtValue,
                example: signal,
                evidenceBundleId: evidenceBundle.id,
            })
        }
    }

    const deduped = [...clusters.values()]
        .sort((left, right) => {
            const severityRank = { regression: 3, failure: 2, warning: 1 }
            return severityRank[right.severity] - severityRank[left.severity]
                || right.count - left.count
                || right.latestGeneratedAt.localeCompare(left.latestGeneratedAt)
        })

    return {
        generated_at: generatedAt,
        benchmark_family: 'orchestration_benchmark_v2',
        profile_tag: profileIdentity.tag,
        machine_key: machineComparisonKey(profileIdentity),
        evidence_bundle_id: evidenceBundle.id,
        cluster_count: deduped.length,
        repeated_cluster_count: deduped.filter((entry) => entry.count > 1).length,
        clusters: deduped,
        clusteringRules: [
            'Scenario statuses cluster by profile, machine, scenario id, and status.',
            'Quality gates cluster by profile, machine, scenario id, gate id, and fail/warn state.',
            'Regression signals cluster by profile, machine, and normalized signal text.',
        ],
        limitations: [
            'Passing high-cost scenarios are not failures and stay in scenario-cost artifacts.',
            'Text normalization is intentionally conservative; semantically similar but differently worded failures may remain separate.',
            'Legacy benchmark artifacts without profile identity are grouped under the current fallback identity only when read through this run.',
        ],
    }
}

function addCluster({
    clusters,
    key,
    kind,
    profileTag,
    machineKey,
    severity,
    generatedAt,
    example,
    evidenceBundleId,
}: {
    clusters: Map<string, {
        key: string
        kind: 'gate' | 'scenario_status' | 'regression_signal'
        profileTag: string
        machineKey: string
        severity: 'warning' | 'failure' | 'regression'
        count: number
        latestGeneratedAt: string
        firstGeneratedAt: string
        examples: string[]
        sourceRuns: string[]
        evidenceBundleId: string
    }>
    key: string
    kind: 'gate' | 'scenario_status' | 'regression_signal'
    profileTag: string
    machineKey: string
    severity: 'warning' | 'failure' | 'regression'
    generatedAt: string
    example: string
    evidenceBundleId: string
}) {
    const existing = clusters.get(key)
    if (!existing) {
        clusters.set(key, {
            key,
            kind,
            profileTag,
            machineKey,
            severity,
            count: 1,
            latestGeneratedAt: generatedAt,
            firstGeneratedAt: generatedAt,
            examples: [example],
            sourceRuns: [generatedAt],
            evidenceBundleId,
        })
        return
    }

    existing.count += 1
    existing.latestGeneratedAt = generatedAt > existing.latestGeneratedAt ? generatedAt : existing.latestGeneratedAt
    existing.firstGeneratedAt = generatedAt < existing.firstGeneratedAt ? generatedAt : existing.firstGeneratedAt
    if (!existing.examples.includes(example) && existing.examples.length < 3) {
        existing.examples.push(example)
    }
    if (!existing.sourceRuns.includes(generatedAt)) {
        existing.sourceRuns.push(generatedAt)
    }
}

function slugForCluster(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'unknown'
}

function renderFailureClustersMarkdown(report: ReturnType<typeof buildFailureClusters>) {
    return `# Benchmark Failure Clusters

Updated: ${report.generated_at.slice(0, 10)}

## Summary
- profile: ${report.profile_tag}
- machine: ${report.machine_key}
- evidence bundle: ${report.evidence_bundle_id}
- clusters: ${report.cluster_count}
- repeated clusters: ${report.repeated_cluster_count}

## Clusters
${report.clusters.map((entry) => `- ${entry.key}: severity=${entry.severity} count=${entry.count} first=${entry.firstGeneratedAt} latest=${entry.latestGeneratedAt} examples=${entry.examples.join(' | ')}`).join('\n') || '- none'}

## Rules
${report.clusteringRules.map((entry) => `- ${entry}`).join('\n')}

## Limitations
${report.limitations.map((entry) => `- ${entry}`).join('\n')}`
}

function buildRootCauseShortlist({
    generatedAt,
    failureClusters,
    evidenceBundle,
    scenarioCostReport,
    trend,
}: {
    generatedAt: string
    failureClusters: ReturnType<typeof buildFailureClusters>
    evidenceBundle: ReturnType<typeof buildSelfEditEvidenceBundle>
    scenarioCostReport: ReturnType<typeof buildScenarioCostReport>
    trend: ReturnType<typeof buildTrendSignal>
}) {
    const candidates = new Map<string, {
        id: string
        cause: string
        confidence: 'low' | 'medium' | 'high'
        score: number
        evidence: string[]
        nextReviewStep: string
        falsePositiveRisks: string[]
        humanReviewRequired: string
    }>()

    const addCandidate = ({
        id,
        cause,
        score,
        evidence,
        nextReviewStep,
        falsePositiveRisks,
        humanReviewRequired,
    }: {
        id: string
        cause: string
        score: number
        evidence: string[]
        nextReviewStep: string
        falsePositiveRisks: string[]
        humanReviewRequired: string
    }) => {
        const existing = candidates.get(id)
        if (!existing) {
            candidates.set(id, {
                id,
                cause,
                confidence: score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low',
                score,
                evidence,
                nextReviewStep,
                falsePositiveRisks,
                humanReviewRequired,
            })
            return
        }
        existing.score = Math.max(existing.score, score)
        existing.confidence = existing.score >= 85 ? 'high' : existing.score >= 60 ? 'medium' : 'low'
        for (const item of evidence) {
            if (!existing.evidence.includes(item)) existing.evidence.push(item)
        }
    }

    const topCost = scenarioCostReport.highestCostScenarios[0] || null
    const repeatedClusters = failureClusters.clusters.filter((entry) => entry.count > 1)
    const omissionClusters = failureClusters.clusters.filter((entry) => entry.key.includes('omission_pressure') || entry.examples.some((example) => example.toLowerCase().includes('omission')))
    const scenarioStatusClusters = failureClusters.clusters.filter((entry) => entry.kind === 'scenario_status')
    const gateClusters = failureClusters.clusters.filter((entry) => entry.kind === 'gate')
    const regressionSignalClusters = failureClusters.clusters.filter((entry) => entry.kind === 'regression_signal')
    const contextDominated = Boolean(topCost?.dominantCost.startsWith('context:'))

    if (omissionClusters.length > 0 || trend.omissionPressureDelta.delta !== null && trend.omissionPressureDelta.delta > 0) {
        const strongest = omissionClusters[0]
        addCandidate({
            id: 'context-packing-omission-pressure',
            cause: 'Context packing is probably dropping hot evidence under pressure.',
            score: Math.min(100, 58
                + (strongest?.count || 0) * 5
                + (contextDominated ? 14 : 0)
                + (trend.omissionPressureDelta.delta && trend.omissionPressureDelta.delta > 0 ? 8 : 0)),
            evidence: [
                strongest ? `cluster=${strongest.key} count=${strongest.count}` : 'no omission cluster, but trend shows omission pressure',
                `trend omission delta=${trend.omissionPressureDelta.delta ?? 'n/a'}`,
                topCost ? `top cost scenario=${topCost.label} dominant=${topCost.dominantCost} packed=${topCost.packedTokens} omitted=${topCost.omittedTokens}` : 'top cost scenario missing',
                `evidence bundle=${evidenceBundle.id}`,
            ],
            nextReviewStep: 'Open the top-cost scenario replay and inspect which hot context segments were omitted before changing pack budgets or priority rules.',
            falsePositiveRisks: [
                'Omission warnings can repeat because the benchmark intentionally stresses the same pressure path.',
                'A high context cost can be expected for larger scenarios and is not automatically a regression.',
            ],
            humanReviewRequired: 'Confirm the omitted segments were actually needed by the worker that produced the warning.',
        })
    }

    if (gateClusters.length > 0 && scenarioStatusClusters.length > 0) {
        const gate = gateClusters[0]
        const status = scenarioStatusClusters[0]
        addCandidate({
            id: 'export-quality-gate-contract-drift',
            cause: 'Scenario output may be drifting away from the export quality-gate contract.',
            score: Math.min(100, 50 + gate.count * 4 + status.count * 3 + (gate.severity === 'failure' ? 14 : 0)),
            evidence: [
                `gate cluster=${gate.key} count=${gate.count} severity=${gate.severity}`,
                `status cluster=${status.key} count=${status.count} severity=${status.severity}`,
                `examples=${[...gate.examples, ...status.examples].slice(0, 3).join(' | ')}`,
            ],
            nextReviewStep: 'Compare the failing export artifact against the gate definition before changing benchmark expectations.',
            falsePositiveRisks: [
                'A warning-only gate can represent acceptable caution rather than a broken contract.',
                'Legacy history can amplify a cluster count when the scenario intentionally repeats similar checks.',
            ],
            humanReviewRequired: 'Decide whether the quality gate or the worker output is the stale side of the contract.',
        })
    }

    if (regressionSignalClusters.length > 0 && trend.status === 'regressed') {
        const signal = regressionSignalClusters[0]
        addCandidate({
            id: 'matched-profile-regression',
            cause: 'The current run appears worse than the matched profile baseline.',
            score: Math.min(100, 62 + regressionSignalClusters.length * 6 + repeatedClusters.length * 3),
            evidence: [
                `trend=${trend.status} baseline=${trend.baselineStatus}${trend.baselineGeneratedAt ? ` ${trend.baselineGeneratedAt}` : ''}`,
                `regression cluster=${signal.key} count=${signal.count}`,
                `signals=${trend.regressionSignals.join(' | ') || 'none'}`,
            ],
            nextReviewStep: 'Review the previous same-profile benchmark next to the latest run before accepting any root-cause edit.',
            falsePositiveRisks: [
                'Small score deltas can come from demo-worker timing or filesystem variance.',
                'Regression text clustering is conservative and may miss related signals in different wording.',
            ],
            humanReviewRequired: 'Check that the machine key and profile tag are comparable and that the baseline is not stale.',
        })
    }

    if (candidates.size === 0 && topCost) {
        addCandidate({
            id: 'cost-hotspot-without-regression',
            cause: 'No regression is proven, but the highest-cost scenario is the best review starting point.',
            score: Math.min(59, 35 + Math.round((topCost.costShare || 0) * 40)),
            evidence: [
                `top cost scenario=${topCost.label} cost=${topCost.costScore} share=${topCost.costShare}`,
                `trend=${trend.status}`,
                `clusters=${failureClusters.cluster_count}`,
            ],
            nextReviewStep: 'Use the cost report as a triage guide only; do not change behavior without a failing or warning signal.',
            falsePositiveRisks: [
                'High cost alone is not a defect.',
                'The top scenario may simply be the most comprehensive scenario in the suite.',
            ],
            humanReviewRequired: 'Confirm a user-visible or benchmark-visible problem exists before opening a code edit.',
        })
    }

    const ranked = [...candidates.values()]
        .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
        .map((entry, index) => ({
            rank: index + 1,
            ...entry,
        }))

    return {
        generated_at: generatedAt,
        benchmark_family: 'orchestration_benchmark_v2',
        profile_tag: failureClusters.profile_tag,
        machine_key: failureClusters.machine_key,
        evidence_bundle_id: evidenceBundle.id,
        inputArtifacts: {
            failureClusters: 'benchmark-failure-clusters-latest.json',
            evidenceBundle: 'benchmark-self-edit-evidence-bundle-latest.json',
            scenarioCosts: 'benchmark-scenario-costs-latest.json',
            trend: 'benchmark-trend-latest.json',
        },
        trustedInputs: [
            'Deduped failure clusters with profile and machine keys.',
            'The latest self-edit evidence bundle ID and selected packet context.',
            'Scenario cost attribution for locating expensive pressure points.',
            'Profile-aware trend signals, only when a matched profile baseline exists.',
        ],
        candidate_count: ranked.length,
        candidates: ranked,
        reviewPolicy: [
            'Treat the shortlist as triage guidance, not automatic permission to edit.',
            'Prefer the highest-ranked candidate only after checking its cited artifact fields.',
            'If all candidates are low confidence, collect one more benchmark run before acting.',
        ],
    }
}

function renderRootCauseShortlistMarkdown(report: ReturnType<typeof buildRootCauseShortlist>) {
    return `# Benchmark Root-Cause Shortlist

Updated: ${report.generated_at.slice(0, 10)}

## Summary
- profile: ${report.profile_tag}
- machine: ${report.machine_key}
- evidence bundle: ${report.evidence_bundle_id}
- candidates: ${report.candidate_count}

## Candidates
${report.candidates.map((entry) => `- ${entry.rank}. ${entry.cause} score=${entry.score} confidence=${entry.confidence}
  - evidence: ${entry.evidence.join(' | ')}
  - next review: ${entry.nextReviewStep}
  - false-positive risks: ${entry.falsePositiveRisks.join(' | ')}
  - human review: ${entry.humanReviewRequired}`).join('\n') || '- none'}

## Trusted Inputs
${report.trustedInputs.map((entry) => `- ${entry}`).join('\n')}

## Review Policy
${report.reviewPolicy.map((entry) => `- ${entry}`).join('\n')}`
}

function buildSelfImprovementCandidate({
    generatedAt,
    rootCauseShortlist,
    evidenceBundle,
    packetSelection,
    scenarioCostReport,
    trend,
    reviews,
}: {
    generatedAt: string
    rootCauseShortlist: ReturnType<typeof buildRootCauseShortlist>
    evidenceBundle: ReturnType<typeof buildSelfEditEvidenceBundle>
    packetSelection: ReturnType<typeof buildPacketSelection>
    scenarioCostReport: ReturnType<typeof buildScenarioCostReport>
    trend: ReturnType<typeof buildTrendSignal>
    reviews: Awaited<ReturnType<typeof readSelfImprovementReviews>>
}) {
    const topCause = rootCauseShortlist.candidates[0] || null
    const selectedPacket = packetSelection.selectedPacket
    const topCost = scenarioCostReport.highestCostScenarios[0] || null
    const hasActionableCause = Boolean(topCause && topCause.confidence !== 'low')
    const hasEvidenceBundle = evidenceBundle.status === 'ready_for_review'
    const hasConcreteCostTarget = Boolean(topCost)
    const verifiedEnough = hasActionableCause && hasEvidenceBundle && hasConcreteCostTarget
    const verificationSignals = [
        hasActionableCause
            ? `root cause ${topCause?.id} confidence=${topCause?.confidence} score=${topCause?.score}`
            : 'no medium-or-better root cause candidate',
        hasEvidenceBundle
            ? `evidence bundle ${evidenceBundle.id} is ready`
            : `evidence bundle ${evidenceBundle.id} status=${evidenceBundle.status}`,
        hasConcreteCostTarget
            ? `top cost target ${topCost?.label} dominant=${topCost?.dominantCost}`
            : 'no scenario cost target',
        `trend status=${trend.status}`,
        selectedPacket ? `packet selection ${selectedPacket.packet} confidence=${selectedPacket.confidence}` : 'no packet selection',
    ]

    const candidate = verifiedEnough && topCause && topCost
        ? {
            id: `verified-${generatedAt.slice(0, 10)}-${topCause.id}`,
            title: 'Inspect hot-context omission pressure before changing pack policy',
            confidence: topCause.confidence,
            sourceRootCause: {
                id: topCause.id,
                cause: topCause.cause,
                score: topCause.score,
            },
            selectedPacket: selectedPacket
                ? {
                    packet: selectedPacket.packet,
                    title: selectedPacket.title,
                    confidence: selectedPacket.confidence,
                }
                : null,
            targetScenario: {
                id: topCost.id,
                label: topCost.label,
                dominantCost: topCost.dominantCost,
                packedTokens: topCost.packedTokens,
                omittedTokens: topCost.omittedTokens,
                costScore: topCost.costScore,
            },
            nextAction: topCause.nextReviewStep,
            proposedChangeBoundary: [
                'Start with benchmark/replay inspection rather than a broad refactor.',
                'Only adjust context pack priority, omission budget, or scenario expectation after the cited omitted segments are confirmed useful.',
                'Rerun the orchestration benchmark and compare the same profile/machine artifacts.',
            ],
            requiredEvidence: [...new Set([
                ...topCause.evidence,
                `evidence bundle=${evidenceBundle.id}`,
                'scenario cost artifact=benchmark-scenario-costs-latest.json',
                'root-cause artifact=benchmark-root-cause-shortlist-latest.json',
            ])],
            stopConditions: [
                'Stop if the omitted segments are irrelevant to the worker output.',
                'Stop if the same profile baseline no longer reproduces the warning cluster.',
                'Stop if the candidate requires product behavior changes outside benchmark/orchestration code.',
            ],
            humanArbitration: [
                topCause.humanReviewRequired,
                'A reviewer should decide whether the benchmark expectation or the orchestration policy is stale.',
            ],
        }
        : null
    const matchedReview = candidate
        ? reviews.find((review) => review.releaseCandidateId === `rc-${candidate.id}`) || null
        : null
    const candidateReviewState = matchedReview
        ? {
            state: 'matched',
            outcome: matchedReview.outcome,
            reviewId: matchedReview.id,
            decidedAt: matchedReview.decidedAt,
            decidedBy: matchedReview.decidedBy,
            reason: matchedReview.reason,
            releaseCandidateId: matchedReview.releaseCandidateId,
            availableReviewCount: reviews.length,
        }
        : {
            state: reviews.length > 0 ? 'no_matching_review' : 'no_review',
            outcome: null,
            reviewId: null,
            decidedAt: null,
            decidedBy: null,
            reason: null,
            releaseCandidateId: null,
            availableReviewCount: reviews.length,
        }
    const reviewedStatus = candidateReviewState.outcome === 'accepted'
        ? 'candidate_accepted'
        : candidateReviewState.outcome === 'rejected'
            ? 'candidate_rejected'
            : null

    return {
        generated_at: generatedAt,
        benchmark_family: 'orchestration_benchmark_v2',
        profile_tag: rootCauseShortlist.profile_tag,
        machine_key: rootCauseShortlist.machine_key,
        status: reviewedStatus || (verifiedEnough ? 'candidate_ready' : 'needs_more_evidence'),
        stoppingRule: reviewedStatus === 'candidate_accepted'
            ? 'Candidate has been accepted by review and may proceed only within the recorded release-candidate boundary.'
            : reviewedStatus === 'candidate_rejected'
                ? `Candidate was rejected by review: ${candidateReviewState.reason || 'No reason recorded.'}`
                : verifiedEnough
                    ? 'Candidate is ready for human review before implementation.'
                    : 'Do not open a self-edit until a medium-or-better root cause, ready evidence bundle, and concrete scenario target are all present.',
        verificationSignals,
        candidate,
        reviewState: candidateReviewState,
        inputArtifacts: {
            rootCauseShortlist: 'benchmark-root-cause-shortlist-latest.json',
            evidenceBundle: 'benchmark-self-edit-evidence-bundle-latest.json',
            packetSelection: 'benchmark-packet-selection-latest.json',
            scenarioCosts: 'benchmark-scenario-costs-latest.json',
            trend: 'benchmark-trend-latest.json',
        },
    }
}

function renderSelfImprovementCandidateMarkdown(report: ReturnType<typeof buildSelfImprovementCandidate>) {
    const candidate = report.candidate
    return `# Verified Self-Improvement Candidate

Updated: ${report.generated_at.slice(0, 10)}

## Summary
- status: ${report.status}
- profile: ${report.profile_tag}
- machine: ${report.machine_key}
- stopping rule: ${report.stoppingRule}
- review state: ${report.reviewState.state}${report.reviewState.reviewId ? ` (${report.reviewState.reviewId})` : ''}
- review outcome: ${report.reviewState.outcome || 'none'}

## Verification Signals
${report.verificationSignals.map((entry) => `- ${entry}`).join('\n')}

## Candidate
${candidate ? `- id: ${candidate.id}
- title: ${candidate.title}
- confidence: ${candidate.confidence}
- root cause: ${candidate.sourceRootCause.id} (${candidate.sourceRootCause.score})
- selected packet: ${candidate.selectedPacket ? `${candidate.selectedPacket.packet} ${candidate.selectedPacket.title}` : 'none'}
- target scenario: ${candidate.targetScenario.label} dominant=${candidate.targetScenario.dominantCost} packed=${candidate.targetScenario.packedTokens} omitted=${candidate.targetScenario.omittedTokens}
- next action: ${candidate.nextAction}` : '- none'}

## Proposed Boundary
${candidate ? candidate.proposedChangeBoundary.map((entry) => `- ${entry}`).join('\n') : '- none'}

## Required Evidence
${candidate ? candidate.requiredEvidence.map((entry) => `- ${entry}`).join('\n') : '- none'}

## Stop Conditions
${candidate ? candidate.stopConditions.map((entry) => `- ${entry}`).join('\n') : '- none'}

## Human Arbitration
${candidate ? candidate.humanArbitration.map((entry) => `- ${entry}`).join('\n') : '- none'}`
}

async function readSelfImprovementReviews(dir: string) {
    const entries = await fs.readdir(dir).catch(() => [])
    const reviews = []
    for (const entry of entries) {
        if (!entry.endsWith('.json')) continue
        const review = await readSelfImprovementReview(path.join(dir, entry), entry)
        if (review) {
            reviews.push(review)
        }
    }
    const deduped = new Map<string, NonNullable<Awaited<ReturnType<typeof readSelfImprovementReview>>>>()
    for (const review of reviews) {
        const key = review.id || review.fileName
        const existing = deduped.get(key)
        if (!existing || String(review.decidedAt || '') > String(existing.decidedAt || '')) {
            deduped.set(key, review)
        }
    }
    return [...deduped.values()].sort((left, right) => String(right.decidedAt || '').localeCompare(String(left.decidedAt || '')))
}

async function readSelfImprovementReview(filePath: string, fileName: string) {
    try {
        const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as {
            id?: string
            decided_at?: string
            decided_by?: string
            outcome?: string
            reason?: string
            releaseCandidate?: {
                id?: string
            }
            verification?: string[]
        }
        if (parsed.outcome !== 'accepted' && parsed.outcome !== 'rejected') {
            return null
        }
        return {
            id: parsed.id || null,
            fileName,
            decidedAt: parsed.decided_at || null,
            decidedBy: parsed.decided_by || null,
            outcome: parsed.outcome,
            reason: parsed.reason || 'No reason recorded.',
            releaseCandidateId: parsed.releaseCandidate?.id || null,
            verification: Array.isArray(parsed.verification) ? parsed.verification : [],
        }
    } catch {
        return null
    }
}

function buildSelfImprovementReleaseCandidate({
    generatedAt,
    selfImprovementCandidate,
    evidenceBundle,
    rootCauseShortlist,
    scenarioCostReport,
    reviews,
}: {
    generatedAt: string
    selfImprovementCandidate: ReturnType<typeof buildSelfImprovementCandidate>
    evidenceBundle: ReturnType<typeof buildSelfEditEvidenceBundle>
    rootCauseShortlist: ReturnType<typeof buildRootCauseShortlist>
    scenarioCostReport: ReturnType<typeof buildScenarioCostReport>
    reviews: Awaited<ReturnType<typeof readSelfImprovementReviews>>
}) {
    const candidate = selfImprovementCandidate.candidate
    const ready = Boolean(candidate) && selfImprovementCandidate.status !== 'needs_more_evidence'
    const releaseCandidate = ready && candidate
        ? {
            id: `rc-${candidate.id}`,
            title: candidate.title,
            status: 'awaiting_human_review',
            candidateId: candidate.id,
            confidence: candidate.confidence,
            scope: 'benchmark-orchestration-self-improvement',
            targetScenario: candidate.targetScenario,
            proposedChangeBoundary: candidate.proposedChangeBoundary,
            requiredEvidence: candidate.requiredEvidence,
            validationPlan: [
                'Inspect the cited top-cost replay and omitted hot context segments.',
                'Implement only the smallest benchmark/orchestration change justified by that inspection.',
                'Run `cd gpt/api && npm run lint`.',
                'Run `cd gpt/api && npm run orchestration:benchmark`.',
                'Compare the same profile and machine artifacts before accepting.',
            ],
            rollbackPlan: [
                'Reject the release candidate if omitted context is irrelevant.',
                'Reject the release candidate if verification does not reduce the warning cluster or preserve benchmark score.',
                'Keep the generated artifacts as evidence even when rejected.',
            ],
        }
        : null
    const matchedReview = releaseCandidate
        ? reviews.find((review) => review.releaseCandidateId === releaseCandidate.id) || null
        : null
    const latestReview = reviews[0] || null
    const reviewState = matchedReview
        ? 'matched'
        : latestReview
            ? 'unrelated_latest_review'
            : 'no_review'
    const currentOutcome = matchedReview
        ? {
            state: matchedReview.outcome,
            decidedAt: matchedReview.decidedAt,
            decidedBy: matchedReview.decidedBy,
            reason: matchedReview.reason,
            verification: matchedReview.verification,
        }
        : {
            state: ready ? 'pending' : 'not_available',
            decidedAt: null,
            decidedBy: null,
            reason: ready
                ? 'Generated release candidate is waiting for human review.'
                : selfImprovementCandidate.stoppingRule,
            verification: [],
        }
    const status = !ready
        ? 'blocked_missing_candidate'
        : matchedReview?.outcome === 'accepted'
            ? 'reviewed_accepted'
            : matchedReview?.outcome === 'rejected'
                ? 'reviewed_rejected'
                : 'awaiting_human_review'

    return {
        generated_at: generatedAt,
        benchmark_family: 'orchestration_benchmark_v2',
        profile_tag: selfImprovementCandidate.profile_tag,
        machine_key: selfImprovementCandidate.machine_key,
        status,
        releaseCandidate,
        reviewPath: {
            humanReviewPoint: 'A human reviewer must accept or reject after inspecting the cited replay and validation artifacts.',
            minimumFields: [
                'release candidate id',
                'source candidate id',
                'target scenario',
                'required evidence',
                'validation plan',
                'rollback or rejection plan',
                'explicit outcome',
            ],
            acceptOutcome: {
                state: 'accepted',
                requiredReason: 'Explain why the evidence proves the proposed change is needed.',
                requiredVerification: ['lint passed', 'benchmark passed', 'same-profile comparison reviewed'],
            },
            rejectOutcome: {
                state: 'rejected',
                requiredReason: 'Explain which evidence failed or why the change boundary is wrong.',
                requiredVerification: ['cited artifact reviewed', 'stop condition named'],
            },
        },
        currentOutcome,
        reviewState: {
            state: reviewState,
            availableReviewCount: reviews.length,
            latestReviewId: latestReview?.id || null,
            matchedReleaseCandidateId: matchedReview?.releaseCandidateId || null,
            matchedReviewId: matchedReview?.id || null,
            latestReviewOutcome: latestReview?.outcome || null,
        },
        evidenceLinks: {
            releaseCandidate: 'benchmark-self-improvement-release-candidate-latest.json',
            selfImprovementCandidate: 'benchmark-self-improvement-candidate-latest.json',
            rootCauseShortlist: 'benchmark-root-cause-shortlist-latest.json',
            evidenceBundle: 'benchmark-self-edit-evidence-bundle-latest.json',
            scenarioCosts: 'benchmark-scenario-costs-latest.json',
            benchmark: 'benchmark-latest.json',
        },
        validationSnapshot: {
            evidenceBundle: evidenceBundle.id,
            rootCauseCount: rootCauseShortlist.candidate_count,
            totalCostScore: scenarioCostReport.totals.cost_score,
            topCostScenario: scenarioCostReport.highestCostScenarios[0]?.label || null,
        },
        missingAutomation: [
            'The release candidate does not modify code by itself.',
            'Review history is local artifact state and is not synchronized across machines.',
        ],
    }
}

function renderSelfImprovementReleaseCandidateMarkdown(report: ReturnType<typeof buildSelfImprovementReleaseCandidate>) {
    const releaseCandidate = report.releaseCandidate
    return `# Self-Improvement Release Candidate

Updated: ${report.generated_at.slice(0, 10)}

## Summary
- status: ${report.status}
- profile: ${report.profile_tag}
- machine: ${report.machine_key}
- outcome: ${report.currentOutcome.state}
- reason: ${report.currentOutcome.reason}
- review state: ${report.reviewState.state}${report.reviewState.matchedReviewId ? ` (${report.reviewState.matchedReviewId})` : ''}
- available reviews: ${report.reviewState.availableReviewCount}

## Release Candidate
${releaseCandidate ? `- id: ${releaseCandidate.id}
- title: ${releaseCandidate.title}
- candidate id: ${releaseCandidate.candidateId}
- confidence: ${releaseCandidate.confidence}
- scope: ${releaseCandidate.scope}
- target scenario: ${releaseCandidate.targetScenario.label} dominant=${releaseCandidate.targetScenario.dominantCost}` : '- none'}

## Validation Plan
${releaseCandidate ? releaseCandidate.validationPlan.map((entry) => `- ${entry}`).join('\n') : '- none'}

## Rollback Or Rejection Plan
${releaseCandidate ? releaseCandidate.rollbackPlan.map((entry) => `- ${entry}`).join('\n') : '- none'}

## Review Path
- human review: ${report.reviewPath.humanReviewPoint}
- accept requires: ${report.reviewPath.acceptOutcome.requiredVerification.join(', ')}
- reject requires: ${report.reviewPath.rejectOutcome.requiredVerification.join(', ')}
- latest review match: ${report.reviewState.state}
- matched review id: ${report.reviewState.matchedReviewId || 'none'}

## Evidence Links
${Object.entries(report.evidenceLinks).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

## Missing Automation
${report.missingAutomation.map((entry) => `- ${entry}`).join('\n')}`
}

async function buildSelfImprovementReplayInspection({
    generatedAt,
    selfImprovementCandidate,
    selfImprovementReleaseCandidate,
    scenarioResults,
}: {
    generatedAt: string
    selfImprovementCandidate: ReturnType<typeof buildSelfImprovementCandidate>
    selfImprovementReleaseCandidate: ReturnType<typeof buildSelfImprovementReleaseCandidate>
    scenarioResults: Array<{
        id: string
        label: string
        score: number
        status: string
        runId: string
        replayPath: string
        warningGates: string[]
        failedGates: string[]
        cost: ScenarioCost
        metrics: {
            omittedHotSegments: number
        }
    }>
}) {
    const targetId = selfImprovementCandidate.candidate?.targetScenario.id || null
    const target = targetId
        ? scenarioResults.find((entry) => entry.id === targetId) || null
        : null
    if (!target) {
        return {
            generated_at: generatedAt,
            status: 'blocked_missing_target_scenario',
            targetScenario: null,
            run: null,
            contextPressure: null,
            replayExcerpt: null,
            recommendation: 'no_review_change',
            rationale: 'No target scenario was available for replay inspection.',
        }
    }

    const run = await readRun(target.runId)
    const replayText = await fs.readFile(target.replayPath, 'utf8').catch(() => '')
    const segmentById = new Map(run.context.segments.map((segment) => [segment.id, segment]))
    const packSummaries = run.context.packs.map((pack) => {
        const omitted = pack.omitted.map((entry) => {
            const segment = segmentById.get(entry.id)
            return {
                id: entry.id,
                label: entry.label,
                role: pack.role,
                estimatedTokens: entry.estimatedTokens,
                reason: entry.reason,
                temperature: segment?.temperature || 'unknown',
                priority: segment?.priority ?? null,
                roleAffinity: segment?.roleAffinity || [],
            }
        })
        const included = pack.included.map((entry) => {
            const segment = segmentById.get(entry.id)
            return {
                id: entry.id,
                label: entry.label,
                role: pack.role,
                estimatedTokens: entry.estimatedTokens,
                reason: entry.reason,
                temperature: segment?.temperature || 'unknown',
                priority: segment?.priority ?? null,
            }
        })
        return {
            nodeId: pack.nodeId,
            role: pack.role,
            budgetTokens: pack.budgetTokens,
            usedTokens: pack.usedTokens,
            includedCount: included.length,
            omittedCount: omitted.length,
            omittedTokens: omitted.reduce((sum, entry) => sum + entry.estimatedTokens, 0),
            omittedHotSegments: omitted.filter((entry) => entry.temperature === 'hot' || /hot|high-priority/i.test(entry.reason)).length,
            included,
            omitted,
        }
    })
    const omitted = packSummaries.flatMap((pack) => pack.omitted)
    const omittedHot = omitted.filter((entry) => entry.temperature === 'hot' || /hot|high-priority/i.test(entry.reason))
    const omittedCritical = omittedHot.filter((entry) => Number(entry.priority || 0) >= 5)
    const recommendation = selfImprovementReleaseCandidate.currentOutcome.state === 'rejected'
        ? 'keep_rejected_until_human_replay_review'
        : omittedCritical.length > 0
            ? 'requires_human_review_before_accept'
            : 'no_auto_accept_needed'

    return {
        generated_at: generatedAt,
        status: 'inspection_ready',
        targetScenario: {
            id: target.id,
            label: target.label,
            score: target.score,
            status: target.status,
            warningGates: target.warningGates,
            failedGates: target.failedGates,
        },
        run: {
            id: target.runId,
            replayPath: target.replayPath,
            replayExists: Boolean(replayText),
        },
        contextPressure: {
            costScore: target.cost.costScore,
            dominantCost: target.cost.dominantCost,
            packedTokens: target.cost.packedTokens,
            omittedTokens: target.cost.omittedTokens,
            omittedHotSegments: omittedHot.length,
            omittedCriticalSegments: omittedCritical.length,
            packSummaries,
            topOmitted: [...omitted]
                .sort((left, right) => right.estimatedTokens - left.estimatedTokens)
                .slice(0, 8),
        },
        replayExcerpt: replayText.split('\n').slice(0, 80).join('\n'),
        recommendation,
        rationale: recommendation === 'keep_rejected_until_human_replay_review'
            ? 'A replay inspection artifact now exists, but the existing rejection should remain until a human reviewer decides whether the omitted context was actually needed.'
            : omittedCritical.length > 0
                ? 'The target run omitted hot high-priority context, so review should inspect those omissions before accepting any pack-policy change.'
                : 'The target run does not show omitted critical hot context, so the candidate should not be accepted without stronger evidence.',
    }
}

function renderSelfImprovementReplayInspectionMarkdown(report: Awaited<ReturnType<typeof buildSelfImprovementReplayInspection>>) {
    return `# Self-Improvement Replay Inspection

Updated: ${report.generated_at.slice(0, 10)}

## Summary
- status: ${report.status}
- target: ${report.targetScenario ? `${report.targetScenario.label} (${report.targetScenario.id})` : 'none'}
- run: ${report.run?.id || 'none'}
- replay path: ${report.run?.replayPath || 'none'}
- recommendation: ${report.recommendation}
- rationale: ${report.rationale}

## Context Pressure
${report.contextPressure ? `- cost score: ${report.contextPressure.costScore}
- dominant cost: ${report.contextPressure.dominantCost}
- packed / omitted tokens: ${report.contextPressure.packedTokens} / ${report.contextPressure.omittedTokens}
- omitted hot segments: ${report.contextPressure.omittedHotSegments}
- omitted critical segments: ${report.contextPressure.omittedCriticalSegments}` : '- none'}

## Packs
${report.contextPressure ? report.contextPressure.packSummaries.map((pack) => `- ${pack.role}: used=${pack.usedTokens}/${pack.budgetTokens} included=${pack.includedCount} omitted=${pack.omittedCount} omitted_hot=${pack.omittedHotSegments}`).join('\n') : '- none'}

## Top Omitted Segments
${report.contextPressure ? report.contextPressure.topOmitted.map((entry) => `- ${entry.label}: role=${entry.role} temp=${entry.temperature} priority=${entry.priority ?? 'n/a'} tokens=${entry.estimatedTokens} reason=${entry.reason}`).join('\n') || '- none' : '- none'}

## Replay Excerpt
\`\`\`md
${report.replayExcerpt || 'No replay text available.'}
\`\`\``
}

function buildProfileBaselines({
    generatedAt,
    currentReport,
    history,
}: {
    generatedAt: string
    currentReport: {
        generated_at: string
        profile_identity: BenchmarkProfileIdentity
        average_score: number
        scenario_count: number
        failing_scenarios: number
        warning_scenarios: number
        weakest_scenario: { label: string; score: number } | null
    }
    history: Awaited<ReturnType<typeof readBenchmarkHistory>>
}) {
    const reports = [...history, currentReport]
    const baselines = new Map<string, {
        key: string
        profileTag: string
        generatedAt: string
        averageScore: number
        scenarioCount: number
        warnings: number
        failures: number
        weakestScenario: string
        source: string
    }>()

    for (const report of reports) {
        const profileTag = report.profile_identity?.tag || 'unspecified'
        const generatedAtValue = String(report.generated_at || '')
        const existing = baselines.get(profileTag)
        if (existing && generatedAtValue < existing.generatedAt) {
            continue
        }
        baselines.set(profileTag, {
            key: `orchestration_benchmark_v2:${profileTag}`,
            profileTag,
            generatedAt: generatedAtValue,
            averageScore: Number(report.average_score || 0),
            scenarioCount: Number(report.scenario_count || 0),
            warnings: Number(report.warning_scenarios || 0),
            failures: Number(report.failing_scenarios || 0),
            weakestScenario: report.weakest_scenario
                ? `${report.weakest_scenario.label} (${report.weakest_scenario.score})`
                : 'none',
            source: report.profile_identity?.source || 'legacy_artifact',
        })
    }

    const currentProfileTag = currentReport.profile_identity.tag || 'unspecified'
    return {
        generated_at: generatedAt,
        benchmark_family: 'orchestration_benchmark_v2',
        current_profile_tag: currentProfileTag,
        current_baseline_key: `orchestration_benchmark_v2:${currentProfileTag}`,
        baseline_count: baselines.size,
        baselines: [...baselines.values()].sort((left, right) => left.profileTag.localeCompare(right.profileTag)),
    }
}

function renderProfileBaselinesMarkdown(baselines: ReturnType<typeof buildProfileBaselines>) {
    return `# Benchmark Profile Baselines

Updated: ${baselines.generated_at.slice(0, 10)}

## Current baseline
- family: ${baselines.benchmark_family}
- profile: ${baselines.current_profile_tag}
- key: ${baselines.current_baseline_key}

## Baselines
${baselines.baselines.map((entry) => `- ${entry.key}: latest=${entry.averageScore} generated=${entry.generatedAt} warnings=${entry.warnings} failures=${entry.failures} weakest=${entry.weakestScenario}`).join('\n') || '- none'}`
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

function buildBenchmarkProfileIdentity(): BenchmarkProfileIdentity {
    const candidates = [
        { source: 'HANASAND_BENCHMARK_PROFILE', value: process.env.HANASAND_BENCHMARK_PROFILE },
        { source: 'HANASAND_MODEL_PROFILE', value: process.env.HANASAND_MODEL_PROFILE },
        { source: 'MODEL_NAME_OVERRIDE', value: process.env.MODEL_NAME_OVERRIDE },
        { source: 'HANASAND_MODEL_NAME', value: process.env.HANASAND_MODEL_NAME },
    ]
    const selected = candidates.find((entry) => entry.value?.trim())
    const endpoint = process.env.HANASAND_BENCHMARK_MODEL_URL || process.env.MODEL_API || process.env.HANASAND_MODEL_API || null
    const model = process.env.MODEL_NAME_OVERRIDE || process.env.HANASAND_MODEL_NAME || selected?.value || null
    const fallbackTag = [
        model || 'local',
        os.platform(),
        os.arch(),
        `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}gb`,
    ].join('-')

    return {
        tag: selected?.value?.trim() || fallbackTag,
        source: selected?.source || 'derived_from_machine',
        model: model?.trim() || null,
        endpoint: endpoint?.trim() || null,
        machine: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpuCount: os.cpus().length,
            totalMemoryGb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
        },
    }
}

function machineComparisonKey(identity: BenchmarkProfileIdentity) {
    return [
        identity.machine.platform || 'unknown',
        identity.machine.arch || 'unknown',
        `${identity.machine.cpuCount || 0}cpu`,
        `${identity.machine.totalMemoryGb || 0}gb`,
    ].join(':')
}

function buildProfileComparison({
    generatedAt,
    currentReport,
    history,
}: {
    generatedAt: string
    currentReport: {
        generated_at: string
        profile_identity: BenchmarkProfileIdentity
        average_score: number
        scenario_count: number
        failing_scenarios: number
        warning_scenarios: number
        weakest_scenario: { label: string; score: number } | null
    }
    history: Awaited<ReturnType<typeof readBenchmarkHistory>>
}) {
    const reports = [...history, currentReport]
    const currentMachineKey = machineComparisonKey(currentReport.profile_identity)
    const profiles = new Map<string, {
        tag: string
        source: string
        machineKey: string
        comparableToCurrentMachine: boolean
        runCount: number
        latestGeneratedAt: string
        latestAverageScore: number
        bestAverageScore: number
        worstAverageScore: number
        latestScenarioCount: number
        latestWarnings: number
        latestFailures: number
        latestWeakestScenario: string
    }>()

    for (const report of reports) {
        const identity = report.profile_identity || {
            tag: 'unspecified',
            source: 'legacy_artifact',
            model: null,
            endpoint: null,
            machine: {
                hostname: 'unknown',
                platform: 'unknown',
                arch: 'unknown',
                cpuCount: 0,
                totalMemoryGb: 0,
            },
        }
        const tag = identity.tag || 'unspecified'
        const machineKey = machineComparisonKey(identity)
        const averageScore = Number(report.average_score || 0)
        const existing = profiles.get(tag)
        if (!existing) {
            profiles.set(tag, {
                tag,
                source: identity.source || 'unspecified',
                machineKey,
                comparableToCurrentMachine: machineKey === currentMachineKey,
                runCount: 1,
                latestGeneratedAt: String(report.generated_at || ''),
                latestAverageScore: averageScore,
                bestAverageScore: averageScore,
                worstAverageScore: averageScore,
                latestScenarioCount: Number(report.scenario_count || 0),
                latestWarnings: Number(report.warning_scenarios || 0),
                latestFailures: Number(report.failing_scenarios || 0),
                latestWeakestScenario: report.weakest_scenario
                    ? `${report.weakest_scenario.label} (${report.weakest_scenario.score})`
                    : 'none',
            })
            continue
        }

        existing.runCount += 1
        existing.bestAverageScore = Math.max(existing.bestAverageScore, averageScore)
        existing.worstAverageScore = Math.min(existing.worstAverageScore, averageScore)
        if (String(report.generated_at || '') >= existing.latestGeneratedAt) {
            existing.latestGeneratedAt = String(report.generated_at || '')
            existing.latestAverageScore = averageScore
            existing.latestScenarioCount = Number(report.scenario_count || 0)
            existing.latestWarnings = Number(report.warning_scenarios || 0)
            existing.latestFailures = Number(report.failing_scenarios || 0)
            existing.latestWeakestScenario = report.weakest_scenario
                ? `${report.weakest_scenario.label} (${report.weakest_scenario.score})`
                : 'none'
        }
    }

    return {
        generated_at: generatedAt,
        current_profile: currentReport.profile_identity,
        compared_run_count: reports.length,
        profiles: [...profiles.values()].sort((left, right) => right.latestGeneratedAt.localeCompare(left.latestGeneratedAt)),
        normalization: {
            rule: 'Compare score deltas freely only when profile tag and machine key match; otherwise treat results as adjacent evidence, not a regression baseline.',
            currentMachineKey,
            crossMachineProfiles: [...profiles.values()]
                .filter((entry) => !entry.comparableToCurrentMachine)
                .map((entry) => ({
                    tag: entry.tag,
                    machineKey: entry.machineKey,
                    latestGeneratedAt: entry.latestGeneratedAt,
                })),
        },
    }
}

function renderProfileComparisonMarkdown(comparison: ReturnType<typeof buildProfileComparison>) {
    return `# Benchmark Profile Comparison

Updated: ${comparison.generated_at.slice(0, 10)}

## Current profile
- tag: ${comparison.current_profile.tag}
- source: ${comparison.current_profile.source}
- model: ${comparison.current_profile.model || 'unspecified'}
- endpoint: ${comparison.current_profile.endpoint || 'unspecified'}
- machine: ${comparison.current_profile.machine.platform}/${comparison.current_profile.machine.arch}, ${comparison.current_profile.machine.cpuCount} CPUs, ${comparison.current_profile.machine.totalMemoryGb} GB

## Profiles
${comparison.profiles.map((entry) => `- ${entry.tag}: runs=${entry.runCount} latest=${entry.latestAverageScore} best=${entry.bestAverageScore} worst=${entry.worstAverageScore} warnings=${entry.latestWarnings} failures=${entry.latestFailures} comparable=${entry.comparableToCurrentMachine ? 'yes' : 'no'} machine=${entry.machineKey} weakest=${entry.latestWeakestScenario}`).join('\n') || '- none'}

## Normalization
- rule: ${comparison.normalization.rule}
- current machine key: ${comparison.normalization.currentMachineKey}
- cross-machine profiles: ${comparison.normalization.crossMachineProfiles.map((entry) => `${entry.tag} (${entry.machineKey})`).join(', ') || 'none'}`
}

async function fileExists(filePath: string) {
    try {
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}
