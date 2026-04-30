import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type ReviewOutcome = 'accepted' | 'rejected'

type ReleaseCandidateArtifact = {
    generated_at?: string
    benchmark_family?: string
    profile_tag?: string
    machine_key?: string
    status?: string
    releaseCandidate?: {
        id?: string
        title?: string
        candidateId?: string
        confidence?: string
        scope?: string
        targetScenario?: {
            id?: string
            label?: string
            dominantCost?: string
            packedTokens?: number
            omittedTokens?: number
            costScore?: number
        }
        validationPlan?: string[]
        rollbackPlan?: string[]
        requiredEvidence?: string[]
    } | null
    reviewPath?: {
        humanReviewPoint?: string
        acceptOutcome?: {
            requiredVerification?: string[]
        }
        rejectOutcome?: {
            requiredVerification?: string[]
        }
    }
    evidenceLinks?: Record<string, string>
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..', '..')
const orchestrationDir = path.join(repoRoot, 'gpt', 'api', 'runtime', 'orchestration')
const latestReleaseCandidatePath = path.join(orchestrationDir, 'benchmark-self-improvement-release-candidate-latest.json')
const reviewDir = path.join(orchestrationDir, 'self-improvement-reviews')

const args = parseArgs(process.argv.slice(2))
const outcome = args.outcome

if (outcome !== 'accepted' && outcome !== 'rejected') {
    throw new Error('Expected --outcome accepted or --outcome rejected.')
}

if (!args.reason) {
    throw new Error('Expected --reason with a short review explanation.')
}

const releaseArtifact = JSON.parse(await readFile(latestReleaseCandidatePath, 'utf8')) as ReleaseCandidateArtifact
const releaseCandidate = releaseArtifact.releaseCandidate

if (!releaseCandidate?.id) {
    throw new Error('Latest release-candidate artifact does not contain a release candidate to review.')
}

const decidedAt = new Date().toISOString()
const reviewer = args.reviewer || process.env.USER || 'local-reviewer'
const verification = args.verification.length > 0
    ? args.verification
    : requiredVerificationFor(outcome, releaseArtifact)
const reviewId = [
    releaseCandidate.id,
    outcome,
    decidedAt.replace(/[:.]/g, '-'),
].join('-')

const review = {
    id: reviewId,
    decided_at: decidedAt,
    decided_by: reviewer,
    outcome,
    reason: args.reason,
    releaseCandidate: {
        id: releaseCandidate.id,
        title: releaseCandidate.title || null,
        candidateId: releaseCandidate.candidateId || null,
        confidence: releaseCandidate.confidence || null,
        scope: releaseCandidate.scope || null,
        targetScenario: releaseCandidate.targetScenario || null,
    },
    source: {
        releaseCandidateGeneratedAt: releaseArtifact.generated_at || null,
        profileTag: releaseArtifact.profile_tag || null,
        machineKey: releaseArtifact.machine_key || null,
        benchmarkFamily: releaseArtifact.benchmark_family || null,
        latestReleaseCandidatePath,
    },
    verification,
    evidenceLinks: releaseArtifact.evidenceLinks || {},
    validationPlan: releaseCandidate.validationPlan || [],
    rollbackPlan: releaseCandidate.rollbackPlan || [],
    requiredEvidence: releaseCandidate.requiredEvidence || [],
    nextState: outcome === 'accepted'
        ? 'approved_for_small_scoped_implementation'
        : 'closed_without_code_change',
}

await mkdir(reviewDir, { recursive: true })
const reviewJsonPath = path.join(reviewDir, `${reviewId}.json`)
const reviewMdPath = path.join(reviewDir, `${reviewId}.md`)
const latestReviewJsonPath = path.join(reviewDir, 'latest.json')
const latestReviewMdPath = path.join(reviewDir, 'latest.md')

await writeFile(reviewJsonPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8')
await writeFile(reviewMdPath, `${renderReviewMarkdown(review)}\n`, 'utf8')
await writeFile(latestReviewJsonPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8')
await writeFile(latestReviewMdPath, `${renderReviewMarkdown(review)}\n`, 'utf8')

console.log(JSON.stringify({
    ok: true,
    outcome,
    releaseCandidateId: releaseCandidate.id,
    reviewJsonPath,
    reviewMdPath,
    latestReviewJsonPath,
    latestReviewMdPath,
}, null, 2))

function parseArgs(argv: string[]) {
    const parsed: {
        outcome?: ReviewOutcome
        reason?: string
        reviewer?: string
        verification: string[]
    } = {
        verification: [],
    }

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index]
        const next = argv[index + 1]
        if (arg === '--outcome') {
            parsed.outcome = next as ReviewOutcome
            index += 1
        } else if (arg === '--reason') {
            parsed.reason = next
            index += 1
        } else if (arg === '--reviewer') {
            parsed.reviewer = next
            index += 1
        } else if (arg === '--verification') {
            parsed.verification.push(next)
            index += 1
        }
    }

    return parsed
}

function requiredVerificationFor(outcome: ReviewOutcome, artifact: ReleaseCandidateArtifact) {
    if (outcome === 'accepted') {
        return artifact.reviewPath?.acceptOutcome?.requiredVerification || []
    }
    return artifact.reviewPath?.rejectOutcome?.requiredVerification || []
}

function renderReviewMarkdown(review: {
    id: string
    decided_at: string
    decided_by: string
    outcome: ReviewOutcome
    reason: string
    releaseCandidate: {
        id: string
        title: string | null
        targetScenario: {
            id?: string
            label?: string
            dominantCost?: string
            packedTokens?: number
            omittedTokens?: number
            costScore?: number
        } | null
    }
    verification: string[]
    evidenceLinks: Record<string, string>
    validationPlan: string[]
    rollbackPlan: string[]
    requiredEvidence: string[]
    nextState: string
}) {
    return `# Self-Improvement Review Outcome

Updated: ${review.decided_at.slice(0, 10)}

## Decision
- id: ${review.id}
- outcome: ${review.outcome}
- reviewer: ${review.decided_by}
- reason: ${review.reason}
- next state: ${review.nextState}

## Release Candidate
- id: ${review.releaseCandidate.id}
- title: ${review.releaseCandidate.title || 'untitled'}
- target: ${review.releaseCandidate.targetScenario?.label || 'unknown'}

## Verification
${review.verification.map((entry) => `- ${entry}`).join('\n') || '- none recorded'}

## Evidence Links
${Object.entries(review.evidenceLinks).map(([key, value]) => `- ${key}: ${value}`).join('\n') || '- none'}

## Required Evidence
${review.requiredEvidence.map((entry) => `- ${entry}`).join('\n') || '- none'}

## Validation Plan
${review.validationPlan.map((entry) => `- ${entry}`).join('\n') || '- none'}

## Rollback Or Rejection Plan
${review.rollbackPlan.map((entry) => `- ${entry}`).join('\n') || '- none'}`
}
