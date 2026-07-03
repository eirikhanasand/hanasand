import assert from 'node:assert/strict'
import { buildCommercialReadiness } from '../src/handlers/ai/economics.ts'

type ReadinessInput = Parameters<typeof buildCommercialReadiness>[0]

const reliability: ReadinessInput['reliability'] = {
    incidentStatus: {
        state: 'operational',
        label: 'Users can get work done',
        message: 'Verification and deploy checks are reporting capacity.',
    },
    queueDepth: [],
    verificationLatency: [
        { kind: 'browser', p50Ms: 1200, p95Ms: 2400, sampleCount: 2 },
        { kind: 'design', p50Ms: 1800, p95Ms: 2600, sampleCount: 2 },
    ],
    buildDeploy: [
        { kind: 'build', completed: 1, failed: 0, cancelled: 0, total: 1, successRate: 1 },
        { kind: 'deploy', completed: 1, failed: 0, cancelled: 0, total: 1, successRate: 1 },
    ],
    failedProofCategories: [],
    gpuLanes: [],
    costPerSuccessfulVerifiedBuildNok: 0.5,
    promptTiming: {
        p50FirstUsefulOutputMs: 900,
        p95FirstUsefulOutputMs: 1400,
        sampleCount: 3,
    },
    deployTiming: {
        p50PromptToVerifiedDeployMs: 5000,
        p95PromptToVerifiedDeployMs: 7000,
        sampleCount: 1,
    },
    capacity: {
        totalQueued: 0,
        totalActiveSessions: 1,
        totalAvailableSessions: 2,
    },
}

const readiness = buildCommercialReadiness({
    reliability,
    deployment: {
        deployment_count: 1,
        recent_deployment_count: 0,
        completed_deployments: 1,
        healthchecked_deployments: 1,
        explained_failures: 0,
        deployments_with_sync_events: 1,
        deployments_with_stack: 1,
        deployments_with_access_policy: 1,
        last_deployment_at: '2026-06-01T10:00:00.000Z',
    },
    release: {
        release_count: 1,
        recent_release_count: 0,
        rollback_ready_releases: 1,
        current_releases: 1,
        superseded_releases: 0,
        failed_releases: 0,
        last_release_at: '2026-06-01T10:01:00.000Z',
    },
    designQuality: {
        completed: 2,
        failed: 0,
        total: 2,
        avg_score: 91,
    },
    latestVerificationJobs: [
        {
            kind: 'design',
            id: 'job_design',
            status: 'completed',
            current_step: 'Design QA passed',
            error: null,
            updated_at: '2026-06-01T09:00:00.000Z',
            completed_at: '2026-06-01T09:00:00.000Z',
            cancelled_at: null,
        },
    ],
    latestDeployment: {
        id: 'dep_1',
        status: 'running',
        vm_name: 'vm-a',
        service_name: 'workspace',
        stack_type: 'nextjs_docker',
        access_policy: 'owner_only',
        healthcheck_url: 'http://127.0.0.1:3000/',
        failure_reason: null,
        updated_at: '2026-06-01T10:00:00.000Z',
        completed_at: '2026-06-01T10:00:00.000Z',
    },
    latestRelease: {
        id: 'rel_1',
        status: 'current',
        deployment_id: 'dep_1',
        preview_url: 'https://preview.example.test',
        notes: null,
        updated_at: '2026-06-01T10:01:00.000Z',
    },
    eventCount: 4,
    verifiedUnits: 4,
    costNok: 1,
    productiveMinutes: 2,
})

const deploymentGate = readiness.items.find((item) => item.id === 'deployment_ownership')
assert.equal(deploymentGate?.status, 'operational')
assert.match(deploymentGate?.evidence.join(' ') || '', /1 deployment record/)
assert.doesNotMatch(deploymentGate?.evidence.join(' ') || '', /\b0 deployment records\b/)
assert.doesNotMatch(deploymentGate?.evidence.join(' ') || '', /\b0 .*usage window\b/)
assert.doesNotMatch(deploymentGate?.evidence.join(' ') || '', /\b0 (superseded|failed)\b/)
assert.match(deploymentGate?.lastAttempt || '', /deployment dep_1 is running/)

const designGate = readiness.items.find((item) => item.id === 'design_quality')
assert.equal(designGate?.status, 'operational')
assert.match(designGate?.evidence.join(' ') || '', /Design QA worker fetches pages/)

const renderedCopy = JSON.stringify(readiness)
assert.doesNotMatch(renderedCopy, /Launch blockers|needs proof|needs work|The product is on the right path/i)
assert.ok(readiness.items.every((item) => item.owner && item.control && item.lastAttempt && item.action))

const emptyReadiness = buildCommercialReadiness({
    reliability: {
        ...reliability,
        queueDepth: [],
        verificationLatency: [],
        buildDeploy: [],
        failedProofCategories: [],
        costPerSuccessfulVerifiedBuildNok: 0,
        promptTiming: {
            p50FirstUsefulOutputMs: 0,
            p95FirstUsefulOutputMs: 0,
            sampleCount: 0,
        },
        deployTiming: {
            p50PromptToVerifiedDeployMs: 0,
            p95PromptToVerifiedDeployMs: 0,
            sampleCount: 0,
        },
        capacity: {
            totalQueued: 0,
            totalActiveSessions: 0,
            totalAvailableSessions: 0,
        },
    },
    deployment: {
        deployment_count: 0,
        recent_deployment_count: 0,
        completed_deployments: 0,
        healthchecked_deployments: 0,
        explained_failures: 0,
        deployments_with_sync_events: 0,
        deployments_with_stack: 0,
        deployments_with_access_policy: 0,
        last_deployment_at: null,
    },
    release: {
        release_count: 0,
        recent_release_count: 0,
        rollback_ready_releases: 0,
        current_releases: 0,
        superseded_releases: 0,
        failed_releases: 0,
        last_release_at: null,
    },
    designQuality: {
        completed: 0,
        failed: 0,
        total: 0,
        avg_score: null,
    },
    latestVerificationJobs: [],
    latestDeployment: undefined,
    latestRelease: undefined,
    eventCount: 0,
    verifiedUnits: 0,
    costNok: 0,
    productiveMinutes: 0,
})

const emptyRenderedCopy = JSON.stringify(emptyReadiness)
for (const staleZero of [
    /\b0 deployment records\b/i,
    /\b0 durable design QA jobs\b/i,
    /\b0 queued\b/i,
    /\b0 completed\b/i,
]) {
    assert.doesNotMatch(emptyRenderedCopy, staleZero)
}
assert.doesNotMatch(emptyRenderedCopy, /Launch blockers|needs proof|needs work|The product is on the right path/i)
for (const id of ['durable_async_verification', 'deployment_ownership', 'verified_outcome_economics', 'non_developer_ux', 'design_quality', 'model_routing_after_measurement']) {
    const item = emptyReadiness.items.find((candidate) => candidate.id === id)
    assert.equal(item?.status, 'internal_action', `${id} should become an internal action when no real records exist.`)
    assert.ok(item?.owner && item.control && item.lastAttempt && item.action, `${id} must expose owner/control/last attempt/action.`)
}

console.log(`AI metrics readiness smoke passed for ${readiness.items.length} gates.`)
