import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActorBusinessModelEvidence } from '../src/app/ti/businessModelEvidence'
import { sanitizeTiResultForPublicPage } from '../src/app/ti/publicResult'
import type { TiSearchResponse } from '../src/utils/ti/search'

const result: TiSearchResponse = {
    query: 'BrainCipher',
    queryKind: 'actor',
    generatedAt: '2026-07-20T15:45:45.322Z',
    mode: 'scraper',
    status: 'ready',
    summary: 'Public reporting about BrainCipher.',
    confidence: 0.8,
    aliases: [],
    recentActivity: [],
    targets: [],
    ttps: [],
    datasets: [],
    sources: [{ id: 'src_ransomwarelive_current_operations_catalog', name: 'Ransomware.live', type: 'api', url: 'https://data.ransomware.live/groups.json', captureId: 'cap_braincipher' }],
    notes: [],
    actorIntelligence: {
        businessModel: {
            schemaVersion: 'ti.actor.business_model.v3',
            evidenceState: 'reviewed_mechanisms',
            extortionModels: [],
            advertisedProducts: [],
            advertisedData: [],
            pricingClaims: [observation('$150,000 to $1,00,0000', 'Ransom demand ranges from $150,000 to $1,00,0000.')],
            negotiationClaims: [observation('Negotiation portal', 'They shifted their Negotiation portal to a new server.')],
            paymentClaims: [observation('Monero (XMR) cryptocurrency', 'Demand to be paid with Monero (XMR) cryptocurrency.')],
            revenueShareClaims: [],
            publicationStrategies: [],
            publicityTactics: [],
            publicityEvents: [],
            pressureTactics: [],
            communicationChannels: [],
            buyerSellerCommunications: [],
            intermediaryCommunications: [],
            monetizationPaths: [],
            profitabilitySignals: [],
            pendingFindings: [{ ...observation('Affiliate recruitment', 'The public report described affiliate recruitment.'), reviewState: 'needs_review', sourceCount: undefined }],
            profitabilityConclusion: { status: 'unknown', summary: 'No source evidence establishes realized revenue or profit.', claimIds: [], sourceIds: [], captureIds: [] },
            missingEvidence: ['realized revenue or profit'],
            evidenceBoundary: 'Third-party reporting does not establish payment or realized profit.',
        },
    },
    actorCaseStudies: {
        schemaVersion: 'ti.actor.case_studies.v2',
        supportedActorCount: 1,
        caseStudyCount: 1,
        pendingActorCount: 1,
        pendingFindingCount: 1,
        qualification: 'Cases require current confirmed review and an exact evidence chain.',
        actorClassCounts: { ransomwareOrExtortion: 1, aptOrIntrusionSet: 0, otherThreatActor: 0 },
        categoryCounts: { negotiation: 1, payment: 2, pricing: 2 },
        cases: [{
            actor: 'BrainCipher',
            actorClass: 'ransomware_or_extortion',
            categories: ['negotiation', 'payment', 'pricing'],
            findingCount: 3,
            evidenceCount: 3,
            captureCount: 1,
            sourceCount: 1,
            firstPublishedAt: '2026-07-19T12:00:00.000Z',
            lastPublishedAt: '2026-07-19T12:00:00.000Z',
            firstCollectedAt: '2026-07-20T15:45:45.322Z',
            lastCollectedAt: '2026-07-20T15:45:45.322Z',
            reviewStates: ['confirmed'],
            findings: [businessFinding()],
        }],
        reviewedFindings: [businessFinding()],
        pendingFindings: [],
        missingContexts: ['reviewed state/APT business-model evidence'],
    },
}

const sanitized = sanitizeTiResultForPublicPage(result)
assert(sanitized)
const publicJson = JSON.stringify(sanitized)
assert.doesNotMatch(publicJson, /reviewedBy|analyst@example\.com|private_channel|t\.me|telegram\.me|tg:|127\.0\.0\.1|\[::1\]/)
const markup = renderToStaticMarkup(<ActorBusinessModelEvidence model={sanitized.actorIntelligence?.businessModel} sources={sanitized.sources} caseStudies={sanitized.actorCaseStudies} />)

assert.match(markup, /Business model and communication/)
assert.match(markup, />Negotiation</)
assert.match(markup, />Payment</)
assert.match(markup, />Pricing</)
assert.match(markup, /\$150,000 to \$1,00,0000/)
assert.match(markup, /Demand to be paid with Monero/)
assert.match(markup, /Third-party report/)
assert.match(markup, /confirmed/)
assert.match(markup, /Capture cap_braincipher/)
assert.match(markup, /Claim claim_braincipher/)
assert.match(markup, /Published 2026-07-19/)
assert.match(markup, /Collected 2026-07-20/)
assert.match(markup, /Profitability unknown/)
assert.match(markup, /realized revenue or profit/)
assert.match(markup, /Pending findings — not case-study evidence/)
assert.match(markup, /Corpus-wide: 1 reviewed multi-category case study across 1 actors/)
assert.doesNotMatch(markup, /href="\/ti\/BrainCipher"/)
assert.match(markup, /0 APT\/intrusion-set/)
assert.match(markup, /Not represented by current retained evidence: reviewed state\/APT business-model evidence/)
assert.doesNotMatch(markup, /javascript:/)

const loading = renderToStaticMarkup(<ActorBusinessModelEvidence sources={[]} state='loading' />)
const empty = renderToStaticMarkup(<ActorBusinessModelEvidence sources={[]} />)
const error = renderToStaticMarkup(<ActorBusinessModelEvidence sources={[]} state='error' error='Threat intelligence search is temporarily unavailable.' />)

assert.match(loading, /Searching retained claims and evidence\./)
assert.match(empty, /No reviewed business-model or communication finding\./)
assert.match(error, /Threat intelligence search is temporarily unavailable\./)
assert.match(error, /role="alert"/)

console.log('TI business-model evidence presentation checks passed.')

function observation(value: string, excerpt: string) {
    return {
        value,
        assertionKind: 'third_party_report',
        evidenceKind: 'third_party_report' as const,
        confidence: 0.76,
        sourceIds: ['src_ransomwarelive_current_operations_catalog'],
        captureIds: ['cap_braincipher'],
        claimIds: ['claim_braincipher'],
        reviewState: 'confirmed',
        reviewReasons: ['Public group descriptions require analyst review.'],
        corroborationState: 'single_source',
        sourceCount: 1,
        evidenceCount: 1,
        firstPublishedAt: '2026-07-19T12:00:00.000Z',
        lastPublishedAt: '2026-07-19T12:00:00.000Z',
        firstCollectedAt: '2026-07-20T15:45:45.322Z',
        lastCollectedAt: '2026-07-20T15:45:45.322Z',
        evidenceStages: ['source_specific'],
        extractionMethods: ['deterministic'],
        extractorVersions: ['ti-source-specific-extractor-v3'],
        evidence: [{
            sourceId: 'src_ransomwarelive_current_operations_catalog',
            captureId: 'cap_braincipher',
            claimId: 'claim_braincipher',
            claimEvidenceId: 'claim-evidence_braincipher',
            entityId: 'entity_braincipher',
            contentHash: 'hash_braincipher',
            url: 'http://127.0.0.1/private',
            publishedAt: '2026-07-19T12:00:00.000Z',
            collectedAt: '2026-07-20T15:45:45.322Z',
            excerpt,
        }],
    }
}

function businessFinding() {
    return {
        actorId: 'test-actors:BrainCipher',
        actor: 'BrainCipher',
        actorClass: 'ransomware_or_extortion' as const,
        category: 'pricing',
        type: 'pricing_claim',
        value: '$150,000 to $1,00,0000',
        assertionKind: 'third_party_report',
        confidence: 0.76,
        claimId: 'claim_braincipher',
        claimEvidenceId: 'claim-evidence_braincipher',
        entityId: 'entity_braincipher',
        captureId: 'cap_braincipher',
        sourceId: 'src_ransomwarelive_current_operations_catalog',
        relationship: 'supports' as const,
        evidenceStage: 'metadata_only_claim',
        reviewState: 'confirmed',
        reviewedAt: '2026-07-20T16:00:00.000Z',
        reviewedBy: 'analyst@example.com',
        reviewReasons: ['Reviewed against exact retained evidence.'],
        contentHash: 'hash_braincipher',
        publishedAt: '2026-07-19T12:00:00.000Z',
        collectedAt: '2026-07-20T15:45:45.322Z',
        url: 'http://[::1]/private',
        excerpt: 'Contact t.me/private_channel or analyst@example.com.',
    }
}
