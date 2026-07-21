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
