import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actorSummary, usefulActorSummary } from '../src/utils/ti/actorSummary'

test('actor summaries turn structured actor facts into customer language', () => {
    const summary = actorSummary({ name: 'APT29', attribution: 'Russia-linked espionage group', targetSectors: ['government'], geographies: ['Norway', 'Sweden'] })
    assert.match(summary, /APT29 is Russia-linked espionage group/)
    assert.match(summary, /targeting government in Norway and Sweden/)
    assert.doesNotMatch(summary, /captured|reviewed|corroborated|evidence available/i)
})

test('actor summaries provide a useful identity description when the feed has only a catalog class', () => {
    assert.match(actorSummary({ name: 'APT29', actorClass: 'observed_threat_actor' }), /Russia-linked espionage group/)
    assert.doesNotMatch(actorSummary({ name: 'APT29', actorClass: 'observed_threat_actor' }), /observed_threat_actor|tracked threat actor/i)
})

test('actor summaries reject internal evidence-state copy', () => {
    assert.equal(usefulActorSummary('3 captured public-intelligence records match apt29; reviewed evidence is available.'), '')
})

test('sparse catalog actors use aliases instead of internal actor classes', () => {
    const summary = actorSummary({ name: 'APT1', aliases: ['Comment Crew', 'Comment Group'], actorClass: 'cataloged_threat_group' })
    assert.equal(summary, 'APT1 is a threat actor also known as Comment Crew and Comment Group.')
    assert.doesNotMatch(summary, /cataloged|tracked|reviewed/i)
})
