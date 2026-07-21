import assert from 'node:assert/strict'
import { buildTiActionability } from '../src/utils/ti/actionability'
import { buildActorIntelligence } from '../src/utils/ti/actorIntelligence'
import { victimObservationsFor } from '../src/utils/ti/actorProfile'
import type { TiSearchResponse } from '../src/utils/ti/search'

const result: TiSearchResponse = {
    query: 'APT29',
    queryKind: 'actor',
    generatedAt: '2026-07-21T09:53:53.332Z',
    mode: 'scraper',
    summary: 'One undated public source describes APT29.',
    confidence: 0.6,
    aliases: ['NOBELIUM'],
    recentActivity: [],
    targets: [],
    ttps: [],
    datasets: [],
    sources: [{
        id: 'src_seed_mitre_attack_apt29',
        name: 'MITRE ATT&CK APT29 Group',
        type: 'static_web',
        provenance: 'https://attack.mitre.org/groups/G0016/',
        lastCollectedAt: '2026-07-21T09:53:53.332Z',
    }],
    notes: [],
    actorIntelligence: {
        attribution: 'Russia-linked SVR/APT29 activity in public reporting.',
        attributionEvidence: {
            sourceId: 'src_seed_mitre_attack_apt29',
            sourceName: 'MITRE ATT&CK APT29 Group',
            provenance: 'https://attack.mitre.org/groups/G0016/',
        },
        confidence: 0.6,
        structuredProvenance: [{
            sourceId: 'src_seed_mitre_attack_apt29',
            sourceName: 'MITRE ATT&CK APT29 Group',
            provenance: 'https://attack.mitre.org/groups/G0016/',
            lastCollectedAt: '2026-07-21T09:53:53.332Z',
            confidence: 0.6,
            shownBecause: 'The captured source names APT29.',
        }],
    },
}

const victims = victimObservationsFor(result)
const actor = buildActorIntelligence(result, victims)
const actionability = buildTiActionability(result, actor, victims)
const operatorEvidence = actionability.geographyHandoffs.find(row => row.role === 'operator')?.evidenceRows[0]

assert.equal(actor.sourceCoverage.latestReportDate, undefined)
assert.equal(operatorEvidence?.reportDate, undefined)

const datedAttributionResult: TiSearchResponse = {
    ...result,
    sources: [{
        id: 'src_newer_unrelated',
        name: 'Newer unrelated report',
        type: 'rss',
        provenance: 'https://example.test/newer',
        reportDate: '2026-02-12T08:00:00.000Z',
    }, {
        id: 'src_attribution',
        name: 'Recorded Future News',
        type: 'rss',
        provenance: 'https://example.test/attribution',
        reportDate: '2025-09-02T07:00:00.000Z',
    }],
    actorIntelligence: {
        ...result.actorIntelligence,
        attribution: 'APT29 activity was attributed to Russia in the cited report.',
        attributionEvidence: {
            sourceId: 'src_attribution',
            sourceName: 'Recorded Future News',
            provenance: 'https://example.test/attribution',
            reportDate: '2025-09-02T07:00:00.000Z',
            captureId: 'cap_attribution',
        },
        structuredProvenance: [{
            sourceId: 'src_newer_unrelated',
            sourceName: 'Newer unrelated report',
            provenance: 'https://example.test/newer',
            reportDate: '2026-02-12T08:00:00.000Z',
            shownBecause: 'The report mentions APT29 without attribution.',
        }, {
            sourceId: 'src_attribution',
            sourceName: 'Recorded Future News',
            provenance: 'https://example.test/attribution',
            reportDate: '2025-09-02T07:00:00.000Z',
            captureId: 'cap_attribution',
            shownBecause: 'The report contains the attribution statement.',
        }],
    },
}
const datedVictims = victimObservationsFor(datedAttributionResult)
const datedActor = buildActorIntelligence(datedAttributionResult, datedVictims)
const datedOperatorEvidence = buildTiActionability(datedAttributionResult, datedActor, datedVictims)
    .geographyHandoffs.find(row => row.role === 'operator')?.evidenceRows[0]

assert.equal(datedOperatorEvidence?.reportDate, '2025-09-02T07:00:00.000Z')
assert.deepEqual(datedOperatorEvidence?.sourceIds, ['src_attribution'])
