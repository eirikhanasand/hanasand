import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actorSummary, usefulActorSummary } from '../src/utils/ti/actorSummary'

test('actor summaries turn structured actor facts into customer language', () => {
    const summary = actorSummary({ name: 'APT29', attribution: 'Russia-linked espionage group', targetSectors: ['government'], geographies: ['Norway', 'Sweden'] })
    assert.match(summary, /APT29 is Russia-linked espionage group/)
    assert.match(summary, /targeting government in Norway and Sweden/)
    assert.doesNotMatch(summary, /captured|reviewed|corroborated|evidence available/i)
})

test('actor summaries reject internal evidence-state copy', () => {
    assert.equal(usefulActorSummary('3 captured public-intelligence records match apt29; reviewed evidence is available.'), '')
})
