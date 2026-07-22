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
            schemaVersion: 'ti.actor.business_model.v2',
            evidenceState: 'observed_mechanisms',
            extortionModels: [],
            advertisedProducts: [],
            advertisedData: [],
            pricingClaims: [observation('$150,000 to $1,00,0000', 'Ransom demand ranges from $150,000 to $1,00,0000.')],
            paymentClaims: [observation('Monero (XMR) cryptocurrency', 'Demand to be paid with Monero (XMR) cryptocurrency.')],
            revenueShareClaims: [],
            publicationStrategies: [],
            publicityTactics: [],
            publicityEvents: [],
            pressureTactics: [],
            communicationChannels: [observation('Negotiation portal', 'They shifted their Negotiation portal to a new server.')],
            buyerSellerCommunications: [],
            intermediaryCommunications: [],
            monetizationPaths: [],
            profitabilitySignals: [],
            profitabilityConclusion: { status: 'unknown', summary: 'No source evidence establishes realized revenue or profit.', claimIds: [], sourceIds: [], captureIds: [] },
            missingEvidence: ['realized revenue or profit'],
            evidenceBoundary: 'Third-party reporting does not establish payment or realized profit.',
        },
    },
}

const sanitized = sanitizeTiResultForPublicPage(result)
assert(sanitized)
const markup = renderToStaticMarkup(<ActorBusinessModelEvidence model={sanitized.actorIntelligence?.businessModel} sources={sanitized.sources} />)

assert.match(markup, /Business model and communication/)
assert.match(markup, /Communication channels and intermediary activity/)
assert.match(markup, /\$150,000 to \$1,00,0000/)
assert.match(markup, /Demand to be paid with Monero/)
assert.match(markup, /Third-party report/)
assert.match(markup, /Needs review/)
assert.match(markup, /Capture cap_braincipher/)
assert.match(markup, /Profitability unknown/)
assert.match(markup, /realized revenue or profit/)
assert.doesNotMatch(markup, /javascript:/)

const loading = renderToStaticMarkup(<ActorBusinessModelEvidence sources={[]} state='loading' />)
const empty = renderToStaticMarkup(<ActorBusinessModelEvidence sources={[]} />)
const error = renderToStaticMarkup(<ActorBusinessModelEvidence sources={[]} state='error' error='Threat intelligence search is temporarily unavailable.' />)

assert.match(loading, /Searching retained claims and evidence\./)
assert.match(empty, /No explicit business-model or communication evidence found\./)
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
        reviewState: 'needs_review',
        reviewReasons: ['Public group descriptions require analyst review.'],
        corroborationState: 'single_source',
        sourceCount: 1,
        evidenceCount: 1,
        firstSeenAt: '2026-07-20T15:45:45.322Z',
        lastSeenAt: '2026-07-20T15:45:45.322Z',
        evidenceStages: ['source_specific'],
        extractionMethods: ['deterministic'],
        extractorVersions: ['ti-source-specific-extractor-v3'],
        evidence: [{
            sourceId: 'src_ransomwarelive_current_operations_catalog',
            captureId: 'cap_braincipher',
            url: 'javascript:alert(1)',
            collectedAt: '2026-07-20T15:45:45.322Z',
            excerpt,
        }],
    }
}
