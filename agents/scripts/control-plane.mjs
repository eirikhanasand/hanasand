#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const scriptDir = path.dirname(new URL(import.meta.url).pathname)
const repoRoot = path.resolve(scriptDir, '..', '..')
const agentsDir = path.join(repoRoot, 'agents')
const controlPlaneDir = path.join(agentsDir, 'control-plane')
const workPacketsDir = path.join(agentsDir, 'work-packets')
const workResultsDir = path.join(agentsDir, 'work-results')
const reviewBundlesDir = path.join(controlPlaneDir, 'review-bundles')
const experimentsDir = path.join(controlPlaneDir, 'experiments')
const draftPacketsDir = path.join(controlPlaneDir, 'draft-packets')
const statePath = path.join(controlPlaneDir, 'state.json')
const dashboardJsonPath = path.join(controlPlaneDir, 'dashboard.json')
const capabilityJsonPath = path.join(controlPlaneDir, 'capability-inventory.json')
const lifecycleJsonPath = path.join(controlPlaneDir, 'tool-lifecycle.json')
const packetAuditPath = path.join(controlPlaneDir, 'packet-audit.json')
const policyPackManifestPath = path.join(controlPlaneDir, 'policy-packs', 'manifest.json')
const fingerprintPath = path.join(controlPlaneDir, 'codebase-fingerprint.json')
const fingerprintDriftPath = path.join(controlPlaneDir, 'codebase-fingerprint-drift.json')
const artifactIndexPath = path.join(controlPlaneDir, 'artifact-index.json')
const observabilityContractsJsonPath = path.join(controlPlaneDir, 'observability-contracts.json')
const orchestrationBenchmarkJsonPath = path.join(controlPlaneDir, 'orchestration-benchmark.json')
const orchestrationBenchmarkMdPath = path.join(controlPlaneDir, 'orchestration-benchmark.md')
const orchestrationBenchmarkTrendJsonPath = path.join(controlPlaneDir, 'orchestration-benchmark-trend.json')
const orchestrationBenchmarkTrendMdPath = path.join(controlPlaneDir, 'orchestration-benchmark-trend.md')
const scenarioSynthesisJsonPath = path.join(controlPlaneDir, 'scenario-synthesis.json')
const scenarioSynthesisMdPath = path.join(controlPlaneDir, 'scenario-synthesis.md')

const argv = process.argv.slice(2)
const command = argv[0] || 'sync'

const flags = parseFlags(argv.slice(1))

await ensureDirectory(reviewBundlesDir)
await ensureDirectory(experimentsDir)
await ensureDirectory(draftPacketsDir)

switch (command) {
    case 'sync':
        await syncControlPlane()
        break
    case 'audit-packets':
        await writePacketAudit()
        break
    case 'refresh-fingerprint':
        await writeFingerprint()
        break
    case 'check-fingerprint':
        await checkFingerprint()
        break
    case 'create-bundle':
        await createReviewBundle({
            id: flags.id,
            summary: flags.summary,
            scope: flags.scope,
            relatedPackets: parseNumberList(flags.packets),
            verification: parseList(flags.verification),
            changedPaths: parseList(flags.paths),
        })
        break
    case 'add-lesson':
        await addLesson({
            category: requiredFlag(flags.category, '--category'),
            message: requiredFlag(flags.message, '--message'),
        })
        break
    case 'set-tool-state':
        await setToolState({
            toolPath: requiredFlag(flags.tool, '--tool'),
            state: requiredFlag(flags.state, '--state'),
            guidance: requiredFlag(flags.guidance, '--guidance'),
        })
        break
    case 'activate-policy-pack':
        await activatePolicyPack({
            version: requiredFlag(flags.version, '--version'),
            approvalId: requiredFlag(flags.approval, '--approval'),
        })
        break
    case 'create-experiment':
        await createExperiment({
            packet: flags.packet,
            name: flags.name,
            owner: flags.owner || 'codex',
            scope: flags.scope || 'repo',
        })
        break
    case 'import-orchestration-benchmark':
        await importOrchestrationBenchmark({
            benchmarkPath: flags.path || path.join(repoRoot, 'gpt', 'api', 'runtime', 'orchestration', 'benchmark-latest.json'),
        })
        break
    case 'autodraft-benchmark-proposals':
        await autodraftBenchmarkProposals()
        break
    case 'quarantine':
        await addQuarantineEntry({
            scope: requiredFlag(flags.scope, '--scope'),
            reason: requiredFlag(flags.reason, '--reason'),
            recoveryPath: requiredFlag(flags.recovery, '--recovery'),
        })
        break
    default:
        throw new Error(`Unknown control-plane command: ${command}`)
}

async function syncControlPlane() {
    const state = await readState()
    const audit = await buildPacketAudit()
    const normalizedState = reconcileProposalStatuses(state, audit)
    const capabilityInventory = buildCapabilityInventory(state)
    const dashboard = buildDashboard(normalizedState, audit, capabilityInventory)
    const fingerprint = await buildFingerprint()
    const lifecycle = buildLifecycleSummary(normalizedState)
    const policyManifest = buildPolicyPackManifest(normalizedState)
    const artifactIndex = await buildArtifactIndex()
    const observabilityContracts = buildObservabilityContracts()

    await fs.writeFile(packetAuditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
    await fs.writeFile(capabilityJsonPath, `${JSON.stringify(capabilityInventory, null, 2)}\n`, 'utf8')
    await fs.writeFile(dashboardJsonPath, `${JSON.stringify(dashboard, null, 2)}\n`, 'utf8')
    await fs.writeFile(lifecycleJsonPath, `${JSON.stringify(lifecycle, null, 2)}\n`, 'utf8')
    await fs.writeFile(policyPackManifestPath, `${JSON.stringify(policyManifest, null, 2)}\n`, 'utf8')
    await fs.writeFile(fingerprintPath, `${JSON.stringify(fingerprint, null, 2)}\n`, 'utf8')
    await fs.writeFile(artifactIndexPath, `${JSON.stringify(artifactIndex, null, 2)}\n`, 'utf8')
    await fs.writeFile(observabilityContractsJsonPath, `${JSON.stringify(observabilityContracts, null, 2)}\n`, 'utf8')
    if (normalizedState.benchmarks.length > 0) {
        const latestBenchmark = normalizedState.benchmarks.at(-1)
        await fs.writeFile(orchestrationBenchmarkJsonPath, `${JSON.stringify(latestBenchmark, null, 2)}\n`, 'utf8')
        await fs.writeFile(orchestrationBenchmarkMdPath, `${renderBenchmarkMarkdown(latestBenchmark)}\n`, 'utf8')
        if (latestBenchmark?.trend) {
            await fs.writeFile(orchestrationBenchmarkTrendJsonPath, `${JSON.stringify(latestBenchmark.trend, null, 2)}\n`, 'utf8')
            await fs.writeFile(orchestrationBenchmarkTrendMdPath, `${renderBenchmarkTrendMarkdown(latestBenchmark.trend)}\n`, 'utf8')
        }
    }
    await fs.writeFile(scenarioSynthesisJsonPath, `${JSON.stringify({
        generated_at: new Date().toISOString(),
        candidates: normalizedState.scenarioCandidates,
    }, null, 2)}\n`, 'utf8')
    await fs.writeFile(scenarioSynthesisMdPath, `${renderScenarioSynthesisMarkdown(normalizedState.scenarioCandidates)}\n`, 'utf8')

    await fs.writeFile(path.join(controlPlaneDir, 'dashboard.md'), `${renderDashboardMarkdown(dashboard)}\n`, 'utf8')
    await fs.writeFile(path.join(controlPlaneDir, 'capability-inventory.md'), `${renderCapabilityMarkdown(capabilityInventory)}\n`, 'utf8')
    await fs.writeFile(path.join(controlPlaneDir, 'lessons-registry.md'), `${renderLessonsMarkdown(normalizedState.lessons)}\n`, 'utf8')
    await fs.writeFile(path.join(controlPlaneDir, 'cross-repo-dependencies.md'), `${renderDependenciesMarkdown(normalizedState.dependencies)}\n`, 'utf8')
    await fs.writeFile(path.join(controlPlaneDir, 'approval-queue.md'), `${renderApprovalsMarkdown(normalizedState.approvals)}\n`, 'utf8')
    await fs.writeFile(path.join(controlPlaneDir, 'proposal-queue.md'), `${renderProposalsMarkdown(normalizedState.proposals)}\n`, 'utf8')
    await fs.writeFile(path.join(controlPlaneDir, 'quarantine-log.md'), `${renderQuarantineMarkdown(normalizedState.quarantineEntries)}\n`, 'utf8')
    await fs.writeFile(path.join(controlPlaneDir, 'feedback-inbox.md'), `${renderFeedbackMarkdown(normalizedState.feedback)}\n`, 'utf8')
    await fs.writeFile(path.join(controlPlaneDir, 'tool-lifecycle.md'), `${renderLifecycleMarkdown(normalizedState.toolLifecycle)}\n`, 'utf8')
    await writeState(normalizedState)
}

async function importOrchestrationBenchmark({ benchmarkPath }) {
    const state = await readState()
    const report = JSON.parse(await fs.readFile(benchmarkPath, 'utf8'))
    state.benchmarks = [...state.benchmarks.filter((entry) => entry.generated_at !== report.generated_at), report]
    state.updatedAt = new Date().toISOString()
    await writeState(state)
    await autodraftBenchmarkProposals({ state })
    console.log(relative(orchestrationBenchmarkJsonPath))
}

async function autodraftBenchmarkProposals({ state: seededState } = {}) {
    const state = seededState || await readState()
    const report = state.benchmarks.at(-1)
    if (!report) {
        throw new Error('No orchestration benchmark found in control-plane state')
    }

    const canonicalPackets = await readCanonicalPacketIndex()
    const canonicalMetaByNumber = await readCanonicalPacketMetadataMap(canonicalPackets)
    const reservedPacketNumbers = await readReservedPacketNumbers(canonicalPackets)
    const expectedDraftPaths = new Set()
    for (const recommendation of report.recommendations || []) {
        const existing = state.proposals.find((entry) =>
            entry.originRecommendationId === recommendation.id
            || (
                entry.summary === recommendation.summary
                && !['completed', 'superseded'].includes(entry.status)
            ),
        )
        const packetNumber = allocateDraftPacketNumber({
            recommendation,
            canonicalMetaByNumber,
            reservedPacketNumbers,
            preferredPacketNumber: Number(existing?.relatedPackets?.[0] || 0),
        })
        reservedPacketNumbers.add(packetNumber)
        const packetStatus = canonicalMetaByNumber.get(packetNumber)?.status || null
        const evidence = collectBenchmarkEvidence(report, recommendation)
        const priority = scoreBenchmarkPriority(report, recommendation, evidence)
        const priorityReason = describeBenchmarkPriority(report, recommendation, evidence, priority)

        if (packetStatus === 'done') {
            if (existing) {
                existing.status = 'superseded'
                existing.priority = 0
                existing.priorityReason = `Packet ${packetNumber} is already done, so benchmark autodrafting should no longer surface it as active work.`
                existing.benchmarkEvidence = evidence
                if (existing.draftPacketPath) {
                    await removeIfExists(path.join(repoRoot, existing.draftPacketPath))
                }
                existing.draftPacketPath = null
            }
            continue
        }

        const proposalId = existing?.id || nextProposalId(state.proposals)
        const draftPacket = buildBenchmarkDraftPacket({
            proposalId,
            report,
            recommendation,
            evidence,
            priority,
            packetNumber,
        })
        const draftPacketPath = await writeBenchmarkDraftPacket(draftPacket)
        expectedDraftPaths.add(draftPacketPath)

        if (existing) {
            existing.status = existing.status === 'approved' ? 'approved' : 'proposed'
            existing.risk = recommendation.severity === 'high' ? 'high' : 'medium'
            existing.relatedPackets = [packetNumber]
            existing.summary = recommendation.summary
            existing.rationale = recommendation.rationale
            existing.approvalRequired = false
            existing.origin = 'benchmark'
            existing.originRecommendationId = recommendation.id
            existing.priority = priority
            existing.priorityReason = priorityReason
            existing.benchmarkEvidence = evidence
            existing.draftPacketPath = draftPacketPath
            continue
        }

        state.proposals.push({
            id: proposalId,
            status: 'proposed',
            risk: recommendation.severity === 'high' ? 'high' : 'medium',
            relatedPackets: [packetNumber],
            summary: recommendation.summary,
            rationale: recommendation.rationale,
            approvalRequired: false,
            origin: 'benchmark',
            originRecommendationId: recommendation.id,
            priority,
            priorityReason,
            benchmarkEvidence: evidence,
            draftPacketPath,
        })
    }

    const recommendedPackets = new Set((report.recommendations || []).map((entry) => Number(entry.suggestedPacket)))
    const recommendedRecommendationIds = new Set((report.recommendations || []).map((entry) => entry.id))
    for (const proposal of state.proposals) {
        const relatedPackets = (proposal.relatedPackets || []).map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
        if (!relatedPackets.length) {
            continue
        }
        const statuses = await Promise.all(relatedPackets.map((packetNumber) => readCanonicalPacketStatus(packetNumber)))
        const allDone = statuses.every((status) => status === 'done')
        const stillRecommended = (
            proposal.originRecommendationId
            && recommendedRecommendationIds.has(proposal.originRecommendationId)
        ) || relatedPackets.some((packetNumber) => recommendedPackets.has(packetNumber))
        if (!allDone && stillRecommended) {
            continue
        }
        if (proposal.draftPacketPath) {
            await removeIfExists(path.join(repoRoot, proposal.draftPacketPath))
        }
        if (proposal.status === 'proposed' && !stillRecommended) {
            proposal.status = 'superseded'
        }
        proposal.priority = 0
        proposal.priorityReason = allDone
            ? 'All related canonical packets are already done, so this benchmark draft is no longer active.'
            : 'This draft is no longer backed by the latest benchmark recommendations.'
        proposal.draftPacketPath = null
    }

    state.updatedAt = new Date().toISOString()
    state.scenarioCandidates = synthesizeScenarioCandidates({ state, report })
    await writeState(state)
    await pruneStaleDraftPackets(state, expectedDraftPaths)
    await syncControlPlane()
}

async function createReviewBundle({ id, summary, scope, relatedPackets, verification, changedPaths }) {
    const state = await readState()
    const bundleId = id || `bundle-${new Date().toISOString().replace(/[:.]/g, '-')}`
    const gitPaths = changedPaths.length > 0 ? changedPaths : await getChangedPaths()
    const verificationSteps = verification.length > 0
        ? await runVerificationSteps(verification)
        : []
    const bundle = {
        id: bundleId,
        created_at: new Date().toISOString(),
        scope: scope || 'repo',
        related_packets: relatedPackets,
        summary: summary || 'Generated review bundle',
        changed_paths: gitPaths,
        artifacts: {
            diff_stat: await getDiffStat(gitPaths),
            packet_audit: relative(packetAuditPath),
            dashboard: relative(dashboardJsonPath),
            artifact_index: relative(artifactIndexPath),
        },
        dependency_warnings: buildDependencyWarnings(gitPaths, state.dependencies),
        verification: verificationSteps,
        open_risks: verificationSteps
            .filter((step) => step.status !== 'passed')
            .map((step) => step.summary),
    }

    const jsonPath = path.join(reviewBundlesDir, `${bundleId}.json`)
    const mdPath = path.join(reviewBundlesDir, `${bundleId}.md`)
    await fs.writeFile(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
    await fs.writeFile(mdPath, `${renderReviewBundleMarkdown(bundle)}\n`, 'utf8')
    console.log(relative(jsonPath))
}

async function createExperiment({ packet, name, owner, scope }) {
    const normalizedName = sanitizeSlug(name || 'experiment')
    const packetNumber = String(packet || 'xx').padStart(2, '0')
    const base = scope === 'gpt' ? path.join(repoRoot, 'gpt', 'sandbox') : path.join(repoRoot, 'sandbox')
    const dir = path.join(base, `packet-${packetNumber}-${normalizedName}`)
    await ensureDirectory(dir)
    const meta = {
        id: `EXP-${new Date().toISOString().slice(0, 10)}-${packetNumber}-${normalizedName}`,
        packet: Number(packetNumber),
        owner,
        scope,
        path: path.relative(repoRoot, dir),
        createdAt: new Date().toISOString(),
        promotionRule: 'Promote only through a normal patch and result note.',
    }
    await fs.writeFile(path.join(dir, 'README.md'), `${renderExperimentReadme(meta)}\n`, 'utf8')
    await fs.writeFile(path.join(experimentsDir, `${path.basename(dir)}.json`), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
    console.log(path.relative(repoRoot, dir))
}

async function addQuarantineEntry({ scope, reason, recoveryPath }) {
    const state = await readState()
    const id = `Q-${new Date().toISOString().slice(0, 10)}-${String(state.quarantineEntries.length + 1).padStart(3, '0')}`
    state.quarantineEntries.push({
        id,
        state: 'open',
        scope,
        reason,
        recoveryPath,
    })
    state.updatedAt = new Date().toISOString()
    await writeState(state)
    await syncControlPlane()
    console.log(id)
}

async function addLesson({ category, message }) {
    const state = await readState()
    state.lessons.push({ category, message })
    state.updatedAt = new Date().toISOString()
    await writeState(state)
    await syncControlPlane()
}

async function setToolState({ toolPath, state: nextState, guidance }) {
    const state = await readState()
    const existing = state.toolLifecycle.find((entry) => entry.toolPath === toolPath)
    if (existing) {
        existing.state = nextState
        existing.guidance = guidance
    } else {
        state.toolLifecycle.push({ toolPath, state: nextState, guidance })
    }
    state.updatedAt = new Date().toISOString()
    await writeState(state)
    await syncControlPlane()
}

async function activatePolicyPack({ version, approvalId }) {
    const state = await readState()
    const approval = state.approvals.find((entry) => entry.id === approvalId)
    if (!approval || approval.status !== 'approved') {
        throw new Error(`Approval ${approvalId} is not approved`)
    }
    let activated = false
    for (const entry of state.policyPacks) {
        if (entry.version === version) {
            entry.status = 'active'
            entry.activatedAt = new Date().toISOString()
            activated = true
        } else {
            entry.status = 'inactive'
        }
    }
    if (!activated) {
        throw new Error(`Unknown policy pack version ${version}`)
    }
    state.updatedAt = new Date().toISOString()
    await writeState(state)
    await syncControlPlane()
}

async function writePacketAudit() {
    const audit = await buildPacketAudit()
    await fs.writeFile(packetAuditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
}

async function writeFingerprint() {
    const fingerprint = await buildFingerprint()
    await fs.writeFile(fingerprintPath, `${JSON.stringify(fingerprint, null, 2)}\n`, 'utf8')
}

async function checkFingerprint() {
    const current = await buildFingerprint()
    const previous = await fileExists(fingerprintPath)
        ? JSON.parse(await fs.readFile(fingerprintPath, 'utf8'))
        : { fingerprints: [] }
    const byPath = new Map(previous.fingerprints.map((entry) => [entry.path, entry.sha256]))
    const drift = {
        generated_at: new Date().toISOString(),
        changed: current.fingerprints.filter((entry) => byPath.get(entry.path) !== entry.sha256),
        unchanged: current.fingerprints.filter((entry) => byPath.get(entry.path) === entry.sha256).map((entry) => entry.path),
        missing_previous: current.fingerprints.filter((entry) => !byPath.has(entry.path)).map((entry) => entry.path),
    }
    await fs.writeFile(fingerprintDriftPath, `${JSON.stringify(drift, null, 2)}\n`, 'utf8')
}

async function readState() {
    return normalizeState(JSON.parse(await fs.readFile(statePath, 'utf8')))
}

async function writeState(state) {
    await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

async function buildPacketAudit() {
    const canonical = await readCanonicalPacketIndex()
    const allPacketFiles = await fs.readdir(workPacketsDir)
    const packetFiles = allPacketFiles.filter((name) => /^\d{2}-.*\.md$/.test(name))
    const seen = new Map()
    for (const file of packetFiles) {
        const number = Number(file.slice(0, 2))
        seen.set(number, (seen.get(number) || []).concat(file))
    }

    const canonicalRecords = []
    const missing = []
    for (const packet of canonical) {
        const packetPath = path.join(workPacketsDir, packet.file)
        const exists = await fileExists(packetPath)
        const status = exists ? await readFrontmatterField(packetPath, 'status') : null
        canonicalRecords.push({
            number: packet.number,
            file: packet.file,
            exists,
            status,
        })
        if (!exists) {
            missing.push(packet.number)
        }
    }

    const duplicateNumbers = [...seen.entries()]
        .filter(([, files]) => files.length > 1)
        .map(([number, files]) => ({ number, files }))

    return {
        generated_at: new Date().toISOString(),
        canonical_count: canonical.length,
        canonical_packets: canonicalRecords,
        missing_numbers: missing,
        duplicate_numbers: duplicateNumbers,
    }
}

function buildCapabilityInventory(state) {
    const byArea = new Map()
    for (const entry of state.capabilities) {
        const bucket = byArea.get(entry.area) || []
        bucket.push(entry)
        byArea.set(entry.area, bucket)
    }
    const highestValueGaps = state.capabilities
        .filter((entry) => entry.score < 3)
        .sort((a, b) => a.score - b.score || a.capability.localeCompare(b.capability))
        .slice(0, 8)
        .map((entry) => ({
            area: entry.area,
            capability: entry.capability,
            status: entry.status,
            notes: entry.notes,
        }))

    return {
        generated_at: new Date().toISOString(),
        rubric: {
            3: 'shipped',
            2: 'partial',
            1: 'planned',
        },
        areas: [...byArea.entries()].map(([area, entries]) => ({ area, entries })),
        highest_value_gaps: highestValueGaps,
    }
}

function buildDashboard(state, audit, capabilityInventory) {
    const activeApprovalCount = state.approvals.filter((entry) => entry.status === 'pending').length
    const approvedProposalCount = state.proposals.filter((entry) => entry.status === 'approved').length
    const openQuarantineCount = state.quarantineEntries.filter((entry) => entry.state === 'open').length
    const latestBenchmark = state.benchmarks.at(-1) || null
    return {
        generated_at: new Date().toISOString(),
        summary: {
            control_plane_bootstrapped: true,
            active_high_risk_approvals: activeApprovalCount,
            approved_self_improvement_proposals: approvedProposalCount,
            open_quarantine_entries: openQuarantineCount,
            canonical_packet_gaps: audit.missing_numbers,
            duplicate_packet_numbers: audit.duplicate_numbers.map((entry) => entry.number),
        },
        latest_benchmark: latestBenchmark
            ? {
                average_score: latestBenchmark.average_score,
                scenario_count: latestBenchmark.scenario_count,
                failing_scenarios: latestBenchmark.failing_scenarios,
                warning_scenarios: latestBenchmark.warning_scenarios,
                weakest_scenario: latestBenchmark.weakest_scenario,
                trend: latestBenchmark.trend || null,
            }
            : null,
        scenario_synthesis: {
            pending_count: state.scenarioCandidates.filter((entry) => entry.reviewStatus === 'pending').length,
            latest_candidate: state.scenarioCandidates.at(-1) || null,
        },
        top_product_gaps: capabilityInventory.highest_value_gaps.length > 0
            ? capabilityInventory.highest_value_gaps.slice(0, 5)
            : (latestBenchmark?.recommendations || []).slice(0, 5).map((entry) => ({
                area: 'orchestration benchmark',
                capability: entry.summary,
                status: entry.severity,
                notes: entry.rationale,
            })),
        top_self_improvement_work: state.proposals
            .filter((entry) => ['proposed', 'approved'].includes(entry.status))
            .sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(a.id).localeCompare(String(b.id)))
            .slice(0, 5)
            .map((entry) => ({
                id: entry.id,
                relatedPackets: entry.relatedPackets,
                summary: entry.summary,
                status: entry.status,
                priority: entry.priority || 0,
            })),
        lookups: {
            proposal_queue: 'agents/control-plane/proposal-queue.md',
            approvals: 'agents/control-plane/approval-queue.md',
            feedback: 'agents/control-plane/feedback-inbox.md',
            lessons: 'agents/control-plane/lessons-registry.md',
            review_bundles: 'agents/control-plane/review-bundles',
            benchmark: 'agents/control-plane/orchestration-benchmark.md',
            benchmark_trend: 'agents/control-plane/orchestration-benchmark-trend.md',
            draft_packets: 'agents/control-plane/draft-packets',
            scenario_synthesis: 'agents/control-plane/scenario-synthesis.md',
        },
    }
}

function buildLifecycleSummary(state) {
    return {
        generated_at: new Date().toISOString(),
        entries: state.toolLifecycle,
    }
}

function buildObservabilityContracts() {
    return {
        generated_at: new Date().toISOString(),
        contracts: [
            {
                name: 'AIRuntimeState',
                producer: 'api/src/handlers/ai/getRuntime.ts',
                consumer: 'frontend/src/components/ai/useAiWorkbench.ts',
                keyFields: ['connectedClientCount', 'connectedModelNames', 'activeConversationId', 'lastToolRun', 'lastFailure', 'lastUpdatedAt'],
            },
            {
                name: 'AgentVmTarget',
                producer: 'api/src/handlers/vms/getAgentTargets.ts',
                consumer: 'frontend/src/utils/vms/fetch/getAgentTarget.ts',
                keyFields: ['id', 'name', 'network', 'capabilities', 'endpoints'],
            },
            {
                name: 'AIDeployment',
                producer: 'api/src/handlers/ai/deployments.ts',
                consumer: 'frontend/src/components/ai/useAiWorkbench.ts',
                keyFields: ['status', 'previewUrl', 'healthcheckUrl', 'events', 'failureReason'],
            },
        ],
    }
}

async function buildArtifactIndex() {
    const bundles = await listRelativeFiles(reviewBundlesDir)
    const experiments = await listRelativeFiles(experimentsDir)
    const results = await listRelativeFiles(workResultsDir)
    const draftPackets = await listRelativeFiles(draftPacketsDir)
    return {
        generated_at: new Date().toISOString(),
        review_bundles: bundles,
        experiments,
        draft_packets: draftPackets,
        work_results: results.filter((entry) => entry.endsWith('.md')).slice(0, 100),
        benchmarks: [
            relative(orchestrationBenchmarkJsonPath),
            relative(orchestrationBenchmarkMdPath),
            relative(orchestrationBenchmarkTrendJsonPath),
            relative(orchestrationBenchmarkTrendMdPath),
            relative(scenarioSynthesisJsonPath),
            relative(scenarioSynthesisMdPath),
        ],
    }
}

function buildPolicyPackManifest(state) {
    const active = state.policyPacks.find((entry) => entry.status === 'active') || null
    return {
        generated_at: new Date().toISOString(),
        active_version: active?.version || null,
        versions: state.policyPacks,
    }
}

async function buildFingerprint() {
    const gitHead = await safeGit(['rev-parse', 'HEAD'])
    const fingerprintTargets = [
        'agents/AGENTS.md',
        'agents/codex.md',
        'agents/COORDINATION.md',
        'agents/work-packets/README.md',
        'agents/control-plane/state.json',
        'agents/control-plane/dashboard.json',
        'frontend/src/components/ai/useAiWorkbench.ts',
        'gpt/api/src/utils/tools/modelToolLoop.ts',
    ]

    const fingerprints = []
    for (const relativePath of fingerprintTargets) {
        const absolutePath = path.join(repoRoot, relativePath)
        if (!await fileExists(absolutePath)) {
            continue
        }
        const contents = await fs.readFile(absolutePath)
        fingerprints.push({
            path: relativePath,
            sha256: crypto.createHash('sha256').update(contents).digest('hex'),
        })
    }

    return {
        generated_at: new Date().toISOString(),
        git_head: gitHead.trim() || null,
        fingerprints,
    }
}

async function readCanonicalPacketIndex() {
    const text = await fs.readFile(path.join(workPacketsDir, 'README.md'), 'utf8')
    const lines = text.split('\n')
    const packets = []
    let inIndex = false
    for (const line of lines) {
        if (line.startsWith('Packet index:')) {
            inIndex = true
            continue
        }
        if (inIndex && line.startsWith('Audit note')) {
            break
        }
        const match = line.match(/^- `(\d{2})-(.+\.md)`$/)
        if (match) {
            packets.push({
                number: Number(match[1]),
                file: `${match[1]}-${match[2]}`,
            })
        }
    }
    return packets
}

async function readCanonicalPacketStatus(packetNumber) {
    const packet = (await readCanonicalPacketIndex()).find((entry) => entry.number === Number(packetNumber))
    if (!packet) {
        return null
    }

    const packetPath = path.join(workPacketsDir, packet.file)
    if (!await fileExists(packetPath)) {
        return null
    }

    return await readFrontmatterField(packetPath, 'status')
}

async function readCanonicalPacketMetadataMap(canonicalPackets) {
    const map = new Map()
    for (const packet of canonicalPackets) {
        const packetPath = path.join(workPacketsDir, packet.file)
        if (!await fileExists(packetPath)) {
            continue
        }
        const text = await fs.readFile(packetPath, 'utf8')
        map.set(packet.number, {
            number: packet.number,
            file: packet.file,
            path: packetPath,
            status: readFrontmatterValue(text, 'status'),
            heading: text.match(/^# Packet \d+:\s+(.+)$/m)?.[1]?.trim() || '',
        })
    }
    return map
}

async function readReservedPacketNumbers(canonicalPackets) {
    const allPacketFiles = await fs.readdir(workPacketsDir)
    const occupiedNumbers = new Set(
        allPacketFiles
            .map((name) => name.match(/^(\d{2})-/)?.[1])
            .filter(Boolean)
            .map((value) => Number(value)),
    )
    for (const packet of canonicalPackets) {
        occupiedNumbers.add(packet.number)
    }
    return occupiedNumbers
}

function allocateDraftPacketNumber({ recommendation, canonicalMetaByNumber, reservedPacketNumbers, preferredPacketNumber = 0 }) {
    if (Number.isFinite(preferredPacketNumber) && preferredPacketNumber > 0) {
        const preferredCanonical = canonicalMetaByNumber.get(preferredPacketNumber)
        if (!preferredCanonical) {
            return preferredPacketNumber
        }
        if (doesRecommendationFitPacket(recommendation.summary, preferredCanonical.heading)) {
            return preferredPacketNumber
        }
    }
    const suggestedPacket = Number(recommendation.suggestedPacket)
    const canonical = canonicalMetaByNumber.get(suggestedPacket)
    if (!canonical) {
        if (!reservedPacketNumbers.has(suggestedPacket)) {
            return suggestedPacket
        }
        let nextPacket = Math.max(...reservedPacketNumbers, 0) + 1
        while (reservedPacketNumbers.has(nextPacket) || canonicalMetaByNumber.has(nextPacket)) {
            nextPacket += 1
        }
        return nextPacket
    }
    if (doesRecommendationFitPacket(recommendation.summary, canonical.heading)) {
        return suggestedPacket
    }

    let nextPacket = Math.max(...reservedPacketNumbers, 0) + 1
    while (reservedPacketNumbers.has(nextPacket) || canonicalMetaByNumber.has(nextPacket)) {
        nextPacket += 1
    }
    return nextPacket
}

function doesRecommendationFitPacket(summary, heading) {
    const summaryTokens = significantTokens(summary)
    const headingTokens = significantTokens(heading)
    const overlap = [...summaryTokens].filter((token) => headingTokens.has(token))
    return overlap.length >= 2
}

function significantTokens(value) {
    return new Set(
        String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .split(/\s+/)
            .filter((token) => token.length >= 4)
            .filter((token) => !['packet', 'draft', 'with', 'from', 'that', 'this', 'when', 'where', 'high', 'medium', 'under'].includes(token)),
    )
}

async function readFrontmatterField(filePath, field) {
    const text = await fs.readFile(filePath, 'utf8')
    return readFrontmatterValue(text, field)
}

function readFrontmatterValue(text, field) {
    const match = String(text || '').match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
    return match ? match[1].trim() : null
}

async function runVerificationSteps(commands) {
    const results = []
    for (const rawCommand of commands) {
        const command = rawCommand.startsWith('retry:') ? rawCommand.slice('retry:'.length) : rawCommand
        const retryable = rawCommand.startsWith('retry:') || isRetryableCommand(command)
        const maxAttempts = retryable ? 2 : 1
        let lastFailure = null
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const { stdout, stderr } = await execFileAsync('/bin/zsh', ['-lc', command], {
                    cwd: repoRoot,
                    maxBuffer: 1024 * 1024 * 8,
                })
                results.push({
                    command,
                    status: 'passed',
                    attempts: attempt,
                    retryable,
                    summary: attempt > 1 ? `passed after retry ${attempt}` : 'passed',
                    stdout: trimOutput(stdout),
                    stderr: trimOutput(stderr),
                })
                lastFailure = null
                break
            } catch (error) {
                lastFailure = error
                if (attempt === maxAttempts) {
                    results.push({
                        command,
                        status: 'failed',
                        attempts: attempt,
                        retryable,
                        summary: error instanceof Error ? error.message : 'command failed',
                        stdout: trimOutput(error.stdout || ''),
                        stderr: trimOutput(error.stderr || ''),
                    })
                }
            }
        }
        if (lastFailure && !retryable) {
            continue
        }
    }
    return results
}

function isRetryableCommand(command) {
    return /(tsc|playwright|smoke|npm run test|bun run)/.test(command)
}

async function getChangedPaths() {
    const output = await safeGit(['diff', '--name-only', '--', '.'])
    return output.split('\n').map((line) => line.trim()).filter(Boolean)
}

async function getDiffStat(paths) {
    if (!paths || paths.length === 0) {
        return ''
    }
    return await safeGit(['diff', '--stat', '--', ...paths])
}

async function safeGit(args) {
    try {
        const { stdout } = await execFileAsync('git', ['-C', repoRoot, ...args], {
            maxBuffer: 1024 * 1024 * 4,
        })
        return stdout
    } catch {
        return ''
    }
}

function renderDashboardMarkdown(dashboard) {
    const gaps = dashboard.top_product_gaps
        .map((entry, index) => `${index + 1}. ${entry.capability} (${entry.status})`)
        .join('\n') || 'none'
    const benchmarkSection = dashboard.latest_benchmark
        ? `\n## Latest benchmark\n- average score: ${dashboard.latest_benchmark.average_score}\n- scenarios: ${dashboard.latest_benchmark.scenario_count}\n- warn / fail: ${dashboard.latest_benchmark.warning_scenarios} / ${dashboard.latest_benchmark.failing_scenarios}\n- weakest scenario: ${dashboard.latest_benchmark.weakest_scenario ? `${dashboard.latest_benchmark.weakest_scenario.label} (${dashboard.latest_benchmark.weakest_scenario.score})` : 'none'}\n- regression status: ${dashboard.latest_benchmark.trend?.status || 'unknown'}\n- regression summary: ${dashboard.latest_benchmark.trend?.summary || 'none'}\n`
        : ''
    const proposedWork = dashboard.top_self_improvement_work
        .map((entry) => `- ${entry.id}: packet ${entry.relatedPackets.join(' / ')} ${entry.summary} (${entry.status}, priority ${entry.priority})`)
        .join('\n') || 'none'
    const synthesisSection = `\n## Scenario synthesis\n- pending candidates: ${dashboard.scenario_synthesis.pending_count}\n- latest candidate: ${dashboard.scenario_synthesis.latest_candidate ? `${dashboard.scenario_synthesis.latest_candidate.title} (${dashboard.scenario_synthesis.latest_candidate.reviewStatus})` : 'none'}\n`
    return `# Self-Improvement History And Dashboard

Updated: ${dashboard.generated_at.slice(0, 10)}

## Summary
- control-plane bootstrapped: yes
- active high-risk approvals: ${dashboard.summary.active_high_risk_approvals}
- approved self-improvement proposals: ${dashboard.summary.approved_self_improvement_proposals}
- open quarantine entries: ${dashboard.summary.open_quarantine_entries}
- canonical packet gaps: ${dashboard.summary.canonical_packet_gaps.length > 0 ? dashboard.summary.canonical_packet_gaps.join(', ') : 'none'}
- duplicate packet numbers: ${dashboard.summary.duplicate_packet_numbers.length > 0 ? dashboard.summary.duplicate_packet_numbers.join(', ') : 'none'}

## Top product gaps
${gaps}
${benchmarkSection}

## Top self-improvement work
${proposedWork}

## Where to look next
- proposal queue: \`${dashboard.lookups.proposal_queue}\`
- approvals: \`${dashboard.lookups.approvals}\`
- feedback: \`${dashboard.lookups.feedback}\`
- lessons: \`${dashboard.lookups.lessons}\`
- review bundles: \`${dashboard.lookups.review_bundles}\`
- benchmark: \`${dashboard.lookups.benchmark}\`
- benchmark trend: \`${dashboard.lookups.benchmark_trend}\`
- draft packets: \`${dashboard.lookups.draft_packets}\`
- scenario synthesis: \`${dashboard.lookups.scenario_synthesis}\`${synthesisSection}`
}

function renderCapabilityMarkdown(inventory) {
    const sections = inventory.areas.map((area) => {
        const rows = area.entries.map((entry) => `| ${entry.capability} | ${entry.score} ${entry.status} | ${entry.notes} |`).join('\n')
        return `## ${area.area}

| Capability | Score | Notes |
| --- | --- | --- |
${rows}`
    }).join('\n\n')

    const gaps = inventory.highest_value_gaps.map((entry, index) => `${index + 1}. ${entry.capability} (${entry.status})`).join('\n')
        || 'none'

    return `# Capability Inventory And Gap Scoring

Updated: ${inventory.generated_at.slice(0, 10)}

Scoring rubric:
- \`3 shipped\`: works in normal repo flow and has at least one verification path
- \`2 partial\`: real implementation exists but the happy path is incomplete or fragile
- \`1 planned\`: packet exists but there is no durable implementation yet

${sections}

## Highest-value gaps
${gaps}`
}

function renderLessonsMarkdown(lessons) {
    const grouped = groupBy(lessons, 'category')
    const sections = [...grouped.entries()].map(([category, entries]) => {
        const bullets = entries.map((entry) => `- ${entry.message}`).join('\n')
        return `### ${capitalize(category)}\n${bullets}`
    }).join('\n\n')
    return `# Agent Memory And Lessons Registry

Updated: ${new Date().toISOString().slice(0, 10)}

## Durable lessons

${sections}`
}

function renderDependenciesMarkdown(dependencies) {
    const rows = dependencies.map((entry) => `| ${entry.name} | ${entry.type} | ${entry.why} |`).join('\n')
    return `# Cross-Repo Dependency Awareness

Updated: ${new Date().toISOString().slice(0, 10)}

## High-value dependencies

| Dependency | Type | Why it matters |
| --- | --- | --- |
${rows}

## Validation rule
Do not claim end-to-end completion if one of these dependencies was stubbed, blocked, or unavailable.`
}

function renderApprovalsMarkdown(entries) {
    const rows = entries.map((entry) => `| ${entry.id} | ${entry.status} | ${entry.actionClass} | ${entry.why} | ${entry.nextStep} |`).join('\n')
    return `# Approval Queue

Updated: ${new Date().toISOString().slice(0, 10)}

Use this queue when a proposal or action crosses a higher-risk line.

## Current approvals

| ID | Status | Action class | Why approval is needed | Next step |
| --- | --- | --- | --- | --- |
${rows}`
}

function renderProposalsMarkdown(entries) {
    const rows = [...entries]
        .sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(a.id).localeCompare(String(b.id)))
        .map((entry) => `| ${entry.id} | ${entry.status} | ${entry.risk} | ${entry.priority || 0} | ${entry.relatedPackets.join(' / ')} | ${entry.summary} | ${entry.rationale} | ${entry.draftPacketPath || ''} |`)
        .join('\n')
    return `# Self-Improvement Proposal Queue

Updated: ${new Date().toISOString().slice(0, 10)}

## Queue

| ID | Status | Risk | Priority | Packet | Proposal | Rationale | Draft |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}`
}

function renderBenchmarkMarkdown(report) {
    const scenarios = (report.scenario_results || [])
        .map((entry) => `- ${entry.label}: ${entry.status} (${entry.score}) role=${entry.metrics.roleCoverage.toFixed(2)} pack=${entry.metrics.packCoverage.toFixed(2)} evidence=${entry.metrics.evidenceCoverage.toFixed(2)} export=${entry.metrics.exportGateHealth.toFixed(2)}`)
        .join('\n') || 'none'
    const recommendations = (report.recommendations || [])
        .map((entry) => `- packet ${entry.suggestedPacket}: ${entry.summary} (${entry.severity})`)
        .join('\n') || 'none'
    const trend = report.trend
        ? `\n## Trend and regression\n- status: ${report.trend.status}\n- summary: ${report.trend.summary}\n- regression rule: ${report.trend.regressionRule}\n- average score delta: ${report.trend.averageScoreDelta ?? 'n/a'}\n- omission hot-segment delta: ${report.trend.omissionPressureDelta?.delta ?? 'n/a'}\n`
        : ''
    return `# Orchestration Benchmark

Updated: ${String(report.generated_at || '').slice(0, 10)}

## Summary
- average score: ${report.average_score}
- scenarios: ${report.scenario_count}
- pass / warn / fail: ${report.passing_scenarios} / ${report.warning_scenarios} / ${report.failing_scenarios}
- weakest scenario: ${report.weakest_scenario ? `${report.weakest_scenario.label} (${report.weakest_scenario.score})` : 'none'}

## Scenario results
${scenarios}

## Recommended next packets
${recommendations}${trend}`
}

function renderBenchmarkTrendMarkdown(trend) {
    const history = (trend.historyWindow || [])
        .map((entry) => `- ${entry.generatedAt}: average=${entry.averageScore} weakest=${entry.weakestScenario} omitted_hot_segments=${entry.omittedHotSegments}`)
        .join('\n') || 'none'
    return `# Orchestration Benchmark Trend

Updated: ${String(trend.latestGeneratedAt || '').slice(0, 10)}

## Summary
- status: ${trend.status}
- regression rule: ${trend.regressionRule}
- summary: ${trend.summary}
- previous run: ${trend.previousGeneratedAt || 'none'}
- average score delta: ${trend.averageScoreDelta ?? 'n/a'}
- weakest scenario delta: ${trend.weakestScenarioDelta?.label ? `${trend.weakestScenarioDelta.label} ${trend.weakestScenarioDelta.delta ?? 'n/a'}` : 'n/a'}
- omission hot-segment delta: ${trend.omissionPressureDelta?.delta ?? 'n/a'}

## Regression signals
${(trend.regressionSignals || []).map((entry) => `- ${entry}`).join('\n') || '- none'}

## Improvement signals
${(trend.improvementSignals || []).map((entry) => `- ${entry}`).join('\n') || '- none'}

## Recent history
${history}`
}

function renderScenarioSynthesisMarkdown(candidates) {
    const rows = (candidates || [])
        .slice()
        .reverse()
        .map((entry) => `| ${entry.id} | ${entry.reviewStatus} | ${entry.sourceScenarioLabel} | ${entry.kind} | ${entry.linkedProposalIds.join(', ') || 'none'} | ${entry.replayPath || 'none'} |`)
        .join('\n')
    return `# Scenario Synthesis Queue

Updated: ${new Date().toISOString().slice(0, 10)}

## Candidates

| ID | Review | Source scenario | Kind | Linked proposals | Replay |
| --- | --- | --- | --- | --- | --- |
${rows || '| none | none | none | none | none | none |'}
`
}

function renderQuarantineMarkdown(entries) {
    const rows = entries.map((entry) => `| ${entry.id} | ${entry.state} | ${entry.scope} | ${entry.reason} | ${entry.recoveryPath} |`).join('\n')
    return `# Rollback And Quarantine Controls

Updated: ${new Date().toISOString().slice(0, 10)}

## Entries

| ID | State | Scope | Reason | Recovery path |
| --- | --- | --- | --- | --- |
${rows}`
}

function renderFeedbackMarkdown(entries) {
    const rows = entries.map((entry) => `| ${entry.id} | ${entry.severity} | ${entry.area} | ${entry.summary} | ${entry.suggestedPacket} |`).join('\n')
    return `# Human Feedback Ingestion And Prioritization

Updated: ${new Date().toISOString().slice(0, 10)}

## Seeded feedback

| ID | Severity | Area | Summary | Suggested packet |
| --- | --- | --- | --- | --- |
${rows}`
}

function renderLifecycleMarkdown(entries) {
    const rows = entries.map((entry) => `| ${entry.toolPath} | ${entry.state} | ${entry.guidance} |`).join('\n')
    return `# Tool Deprecation And Migration Policy

Updated: ${new Date().toISOString().slice(0, 10)}

## Current examples

| Tool path or pattern | State | Guidance |
| --- | --- | --- |
${rows}`
}

function renderReviewBundleMarkdown(bundle) {
    const packets = bundle.related_packets.map((value) => `- ${value}`).join('\n') || '- none'
    const paths = bundle.changed_paths.map((value) => `- ${value}`).join('\n') || '- none'
    const verification = bundle.verification.map((entry) => `- ${entry.command}: ${entry.status} (${entry.summary})`).join('\n') || '- none'
    const risks = bundle.open_risks.map((value) => `- ${value}`).join('\n') || '- none'
    return `# Change Review Bundle

- id: ${bundle.id}
- created_at: ${bundle.created_at}
- scope: ${bundle.scope}

## Related packets
${packets}

## Summary
${bundle.summary}

## Changed paths
${paths}

## Verification
${verification}

## Dependency warnings
${bundle.dependency_warnings.map((value) => `- ${value}`).join('\n') || '- none'}

## Open risks
${risks}`
}

function renderExperimentReadme(meta) {
    return `# Experiment Sandbox

- id: ${meta.id}
- packet: ${meta.packet}
- owner: ${meta.owner}
- scope: ${meta.scope}
- path: ${meta.path}

Promotion rule:
- ${meta.promotionRule}`
}

function parseFlags(args) {
    const result = {}
    for (let i = 0; i < args.length; i++) {
        const token = args[i]
        if (!token.startsWith('--')) {
            continue
        }
        const key = token.slice(2)
        result[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true'
    }
    return result
}

function parseList(value) {
    if (!value) {
        return []
    }
    return value.split(',').map((entry) => entry.trim()).filter(Boolean)
}

function parseNumberList(value) {
    return parseList(value).map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
}

function requiredFlag(value, name) {
    if (!value) {
        throw new Error(`Missing required flag ${name}`)
    }
    return value
}

function normalizeState(state) {
    return {
        schemaVersion: state.schemaVersion || 1,
        updatedAt: state.updatedAt || new Date().toISOString(),
        approvals: state.approvals || [],
        proposals: (state.proposals || []).map((entry) => ({
            priority: 0,
            priorityReason: '',
            draftPacketPath: null,
            originRecommendationId: null,
            ...entry,
        })),
        quarantineEntries: state.quarantineEntries || [],
        feedback: state.feedback || [],
        lessons: state.lessons || [],
        dependencies: state.dependencies || [],
        toolLifecycle: state.toolLifecycle || [],
        policyPacks: state.policyPacks || [],
        capabilities: state.capabilities || [],
        benchmarks: state.benchmarks || [],
        scenarioCandidates: state.scenarioCandidates || [],
    }
}

function reconcileProposalStatuses(state, audit) {
    const statusByPacket = new Map((audit.canonical_packets || []).map((entry) => [Number(entry.number), entry.status]))
    const proposals = (state.proposals || []).map((entry) => {
        const packetStatuses = (entry.relatedPackets || []).map((packet) => statusByPacket.get(Number(packet)))
        const allDone = packetStatuses.length > 0 && packetStatuses.every((status) => status === 'done')
        if (allDone && entry.status !== 'completed') {
            return {
                ...entry,
                status: 'completed',
            }
        }

        return entry
    })

    return {
        ...state,
        proposals,
    }
}

function nextProposalId(entries) {
    const max = entries.reduce((current, entry) => {
        const match = String(entry.id || '').match(/(\d+)$/)
        return Math.max(current, match ? Number(match[1]) : 0)
    }, 0)
    return `SIP-${new Date().toISOString().slice(0, 10)}-${String(max + 1).padStart(3, '0')}`
}

function collectBenchmarkEvidence(report, recommendation) {
    const weakestScenario = report.weakest_scenario
        ? (report.scenario_results || []).find((entry) => entry.id === report.weakest_scenario.id)
        : null
    const impactedScenarios = (report.scenario_results || []).filter((entry) => {
        if (entry.status !== 'pass') {
            return true
        }
        const gateText = [...(entry.failedGates || []), ...(entry.warningGates || [])].join(' ')
        return /(context|omission|merge|contradiction|export)/i.test(`${gateText} ${recommendation.id}`)
    })
    const gates = Array.from(new Set(impactedScenarios.flatMap((entry) => [
        ...(entry.failedGates || []),
        ...(entry.warningGates || []),
    ])))
    const omittedHotSegments = impactedScenarios.reduce((sum, entry) => sum + Number(entry.metrics?.omittedHotSegments || 0), 0)

    return {
        suite: report.suite,
        generatedAt: report.generated_at,
        averageScore: Number(report.average_score || 0),
        failingScenarios: Number(report.failing_scenarios || 0),
        warningScenarios: Number(report.warning_scenarios || 0),
        weakestScenario: weakestScenario
            ? {
                id: weakestScenario.id,
                label: weakestScenario.label,
                score: weakestScenario.score,
                status: weakestScenario.status,
            }
            : (report.weakest_scenario || null),
        impactedScenarios: impactedScenarios.map((entry) => ({
            id: entry.id,
            label: entry.label,
            status: entry.status,
            score: entry.score,
            failedGates: entry.failedGates || [],
            warningGates: entry.warningGates || [],
            omittedHotSegments: Number(entry.metrics?.omittedHotSegments || 0),
            exportGateHealth: Number(entry.metrics?.exportGateHealth || 0),
            replayPath: entry.replayPath,
        })),
        gates,
        omittedHotSegments,
        recommendationId: recommendation.id,
    }
}

function synthesizeScenarioCandidates({ state, report }) {
    const candidatesByKey = new Map(
        (state.scenarioCandidates || []).map((entry) => {
            const normalizedOriginKey = normalizeScenarioOriginKey(entry.originKey)
            return [normalizedOriginKey, { ...entry, originKey: normalizedOriginKey }]
        }),
    )
    const activeBenchmarkProposals = (state.proposals || []).filter((entry) => entry.origin === 'benchmark')
    const sourceScenarios = (report.scenario_results || []).filter((entry) => {
        return entry.status !== 'pass' || (entry.failedGates || []).length > 0 || (entry.warningGates || []).length > 0
    })
    const scenariosToSynthesize = sourceScenarios.length > 0
        ? sourceScenarios
        : (report.weakest_scenario
            ? (report.scenario_results || []).filter((entry) => entry.id === report.weakest_scenario.id)
            : [])

    for (const scenario of scenariosToSynthesize) {
        const synthesisRule = sourceScenarios.length > 0
            ? 'failed_or_warning_scenario'
            : 'weakest_scenario_pressure_escalation'
        const originKey = [
            scenario.id,
            synthesisRule,
            [...(scenario.failedGates || []), ...(scenario.warningGates || [])].join(','),
        ].join(':')
        const linkedProposalIds = activeBenchmarkProposals
            .filter((entry) => {
                if (!entry.originRecommendationId) {
                    return false
                }
                if (Number(scenario.metrics?.omittedHotSegments || 0) > 0 && entry.originRecommendationId === 'context_pack_omission_budget') {
                    return true
                }
                if (Number(scenario.metrics?.contradictionCoverage || 1) < 1 && entry.originRecommendationId === 'branch_merge_contradictions') {
                    return true
                }
                return entry.originRecommendationId === 'hard_scenario_corpus'
            })
            .map((entry) => entry.id)

        const existing = candidatesByKey.get(originKey)
        const candidate = {
            id: existing?.id || `SCN-${String(report.generated_at || '').replace(/[:.]/g, '-').replace(/[^0-9A-Za-z-]/g, '')}-${String(scenario.id || 'scenario').replace(/[^a-z0-9]+/gi, '-').toUpperCase()}`,
            originKey,
            benchmarkGeneratedAt: report.generated_at,
            sourceScenarioId: scenario.id,
            sourceScenarioLabel: scenario.label,
            replayPath: scenario.replayPath || null,
            kind: sourceScenarios.length > 0 ? 'failure_or_warning' : 'weak_case',
            reviewStatus: existing?.reviewStatus || 'pending',
            title: sourceScenarios.length > 0
                ? `Promote ${scenario.label} failure evidence into a new benchmark seed`
                : `Escalate the weakest passing scenario ${scenario.label}`,
            synthesisRule,
            rationale: buildScenarioSynthesisRationale(scenario),
            seedTask: buildScenarioSeedTask(scenario),
            linkedProposalIds,
            evidence: {
                score: Number(scenario.score || 0),
                status: scenario.status,
                failedGates: scenario.failedGates || [],
                warningGates: scenario.warningGates || [],
                omittedHotSegments: Number(scenario.metrics?.omittedHotSegments || 0),
            },
            promotionRule: 'Review this candidate manually before adding it to the canonical benchmark scenario suite.',
        }
        candidatesByKey.delete(originKey)
        candidatesByKey.set(originKey, candidate)
    }

    return [...candidatesByKey.values()].slice(-25)
}

function normalizeScenarioOriginKey(originKey) {
    const parts = String(originKey || '').split(':')
    if (parts.length >= 3) {
        return parts.slice(-3).join(':')
    }
    return String(originKey || '')
}

function buildScenarioSynthesisRationale(scenario) {
    const gates = [...(scenario.failedGates || []), ...(scenario.warningGates || [])]
    if (gates.length > 0) {
        return `Synthesized from benchmark evidence because ${scenario.label} surfaced quality pressure in ${gates.join(', ')}.`
    }
    return `Synthesized from the weakest passing scenario so the benchmark can get harder without losing the replay-backed evidence path.`
}

function buildScenarioSeedTask(scenario) {
    const omitted = Number(scenario.metrics?.omittedHotSegments || 0)
    const contradictionCoverage = Number(scenario.metrics?.contradictionCoverage || 1)
    const blockedRoleCoverage = Number(scenario.metrics?.blockedRoleCoverage || 1)
    const clauses = [String(scenario.task || '').trim()]
    if (omitted > 0) {
        clauses.push('Raise hot-context pressure and verify that reviewer-critical evidence is preserved instead of omitted.')
    }
    if (contradictionCoverage < 1) {
        clauses.push('Force the branches to disagree on ship versus hold and require an explicit merge decision.')
    }
    if (blockedRoleCoverage < 1) {
        clauses.push('Keep one branch partially blocked and require the final answer to stay honest about unresolved verification.')
    }
    if (clauses.length === 1) {
        clauses.push('Add extra noise or tighter constraints so this previously passing case becomes a stronger reasoning test.')
    }
    return clauses.join(' ')
}

function buildBenchmarkDraftPacket({ proposalId, report, recommendation, evidence, priority, packetNumber }) {
    const filenameBase = `${proposalId.toLowerCase()}-packet-${String(packetNumber).padStart(2, '0')}`
    return {
        proposalId,
        recommendationId: recommendation.id,
        suggestedPacket: Number(packetNumber),
        generatedAt: new Date().toISOString(),
        benchmarkGeneratedAt: report.generated_at,
        priority,
        summary: recommendation.summary,
        rationale: recommendation.rationale,
        severity: recommendation.severity,
        evidence,
        paths: {
            markdown: path.join(draftPacketsDir, `${filenameBase}.md`),
            json: path.join(draftPacketsDir, `${filenameBase}.json`),
        },
    }
}

function scoreBenchmarkPriority(report, recommendation, evidence) {
    const severityBase = recommendation.severity === 'high'
        ? 300
        : recommendation.severity === 'medium'
            ? 200
            : 100
    const failurePressure = Number(report.failing_scenarios || 0) * 25
    const warningPressure = Number(report.warning_scenarios || 0) * 10
    const scoreGap = Math.max(0, 100 - Number(report.average_score || 0))
    const gatePressure = (evidence.gates || []).length * 15
    const omissionPressure = Math.min(60, Number(evidence.omittedHotSegments || 0) * 5)
    const weakestPenalty = Math.max(0, 100 - Number(evidence.weakestScenario?.score || report.average_score || 0))
    return severityBase + failurePressure + warningPressure + scoreGap + gatePressure + omissionPressure + weakestPenalty
}

function describeBenchmarkPriority(report, recommendation, evidence, priority) {
    return `Priority ${priority} from severity=${recommendation.severity}, failing_scenarios=${report.failing_scenarios || 0}, warning_scenarios=${report.warning_scenarios || 0}, weakest_scenario=${evidence.weakestScenario?.label || 'none'} (${evidence.weakestScenario?.score ?? 'n/a'}), gates=${(evidence.gates || []).join(', ') || 'none'}, omitted_hot_segments=${evidence.omittedHotSegments || 0}.`
}

function renderDraftPacketMarkdown(draft) {
    const impacted = draft.evidence.impactedScenarios
        .map((entry) => `- ${entry.label} (${entry.status}, score ${entry.score}) failed=${entry.failedGates.join(', ') || 'none'} warn=${entry.warningGates.join(', ') || 'none'} omitted_hot_segments=${entry.omittedHotSegments}`)
        .join('\n') || '- none'
    return `# Draft Packet Proposal

- proposal: ${draft.proposalId}
- recommendation: ${draft.recommendationId}
- suggested_packet: ${draft.suggestedPacket}
- generated_at: ${draft.generatedAt}
- benchmark_generated_at: ${draft.benchmarkGeneratedAt}
- priority: ${draft.priority}
- severity: ${draft.severity}

## Objective
${draft.summary}

## Why now
${draft.rationale}

## Benchmark evidence
- suite: ${draft.evidence.suite}
- average score: ${draft.evidence.averageScore}
- failing / warning scenarios: ${draft.evidence.failingScenarios} / ${draft.evidence.warningScenarios}
- weakest scenario: ${draft.evidence.weakestScenario ? `${draft.evidence.weakestScenario.label} (${draft.evidence.weakestScenario.score})` : 'none'}
- gates: ${draft.evidence.gates.join(', ') || 'none'}
- omitted hot segments: ${draft.evidence.omittedHotSegments}

## Impacted scenarios
${impacted}

## Scope draft
- convert the benchmark finding into one repo-native packet with explicit shipped scope
- keep proposal generation inside the control plane instead of a separate side channel
- preserve the benchmark evidence that justified the priority
- link the weakest scenario and its failing gates directly into the packet acceptance path

## Validation draft
- rerun benchmark import
- confirm proposal queue ordering reflects the benchmark score
- confirm this draft artifact is regenerated deterministically
- confirm the next result note cites the replay path for the impacted scenario`
}

async function writeBenchmarkDraftPacket(draft) {
    await fs.writeFile(draft.paths.markdown, `${renderDraftPacketMarkdown(draft)}\n`, 'utf8')
    await fs.writeFile(draft.paths.json, `${JSON.stringify(draft, null, 2)}\n`, 'utf8')
    return relative(draft.paths.markdown)
}

async function pruneStaleDraftPackets(state, expectedDraftPaths = null) {
    const keep = expectedDraftPaths
        ? new Set(
            [...expectedDraftPaths].flatMap((entry) => {
                const absoluteMarkdown = path.resolve(repoRoot, entry)
                return [absoluteMarkdown, absoluteMarkdown.replace(/\.md$/, '.json')]
            }),
        )
        : new Set(
            state.proposals
                .map((entry) => entry.draftPacketPath)
                .filter(Boolean)
                .flatMap((entry) => {
                    const absoluteMarkdown = path.resolve(repoRoot, entry)
                    return [absoluteMarkdown, absoluteMarkdown.replace(/\.md$/, '.json')]
                }),
        )
    const entries = await fs.readdir(draftPacketsDir)
    for (const name of entries) {
        if (!name.endsWith('.md') && !name.endsWith('.json')) {
            continue
        }
        const absolutePath = path.join(draftPacketsDir, name)
        if (keep.has(absolutePath)) {
            continue
        }
        await removeIfExists(absolutePath)
    }
}

async function removeIfExists(filePath) {
    try {
        await fs.rm(filePath, { force: true })
    } catch {
        return
    }
}

async function ensureDirectory(dir) {
    await fs.mkdir(dir, { recursive: true })
}

async function listRelativeFiles(dir) {
    if (!await fileExists(dir)) {
        return []
    }
    const names = await fs.readdir(dir)
    return names
        .filter((name) => !name.startsWith('.'))
        .map((name) => path.relative(repoRoot, path.join(dir, name)))
        .sort()
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}

function relative(filePath) {
    return path.relative(repoRoot, filePath)
}

function trimOutput(text) {
    return String(text || '').trim().slice(0, 2000)
}

function sanitizeSlug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'experiment'
}

function groupBy(entries, key) {
    const map = new Map()
    for (const entry of entries) {
        const bucket = map.get(entry[key]) || []
        bucket.push(entry)
        map.set(entry[key], bucket)
    }
    return map
}

function capitalize(value) {
    return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildDependencyWarnings(paths, dependencies) {
    const warnings = []
    const combined = paths.join('\n')
    if (/frontend\//.test(combined)) {
        warnings.push('Frontend changes should be treated as browser-validated only when the browser runtime or Playwright path was actually available.')
    }
    if (/api\//.test(combined) || /gpt\/api\//.test(combined)) {
        warnings.push('API and GPT changes should not be called end-to-end complete if the dependent runtime or remote service was stubbed or unavailable.')
    }
    if (/deploy|vm|repository|github/i.test(combined)) {
        warnings.push(`This change touches cross-repo or external dependencies: ${dependencies.map((entry) => entry.name).join(', ')}`)
    }
    return warnings
}
