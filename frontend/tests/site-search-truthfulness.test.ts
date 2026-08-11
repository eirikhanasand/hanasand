import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actorItems, caseItem, directThreatItem } from '../src/components/header/siteSearch'

test('header search does not invent an actor result for unavailable or empty TI responses', () => {
    assert.deepEqual(actorItems({ query: 'APT29', status: 'unavailable', mode: 'unavailable' }), [])
    assert.deepEqual(actorItems({}), [])
    assert.deepEqual(actorItems({ query: 'APT29', status: 'ready' }), [])
})

test('header search may link an explicit actor only from a ready response', () => {
    assert.deepEqual(actorItems({ query: 'APT29', actor: 'APT29', status: 'ready' }), [{
        id: 'actor:APT29',
        title: 'APT29',
        detail: 'Threat actor profile',
        href: '/ti/APT29',
    }])
    assert.deepEqual(directThreatItem('apt42', [{
        id: 'actor:APT42',
        title: 'APT42',
        detail: 'Threat actor profile · Russia-linked espionage group',
        href: '/ti/apt42',
    }]), {
        id: 'actor:APT42',
        title: 'APT42',
        detail: 'Threat actor profile · Russia-linked espionage group',
        href: '/ti/apt42',
    })
    assert.equal(directThreatItem('apt42'), null)
    assert.equal(directThreatItem(''), null)
})

test('header case results never display a raw organization identifier', () => {
    assert.deepEqual(caseItem({ id: 'case-1', title: 'Incident', status: 'open', organizationId: 'tenant-secret', summary: 'Review required.' }), {
        id: 'case:case-1',
        title: 'Incident',
        detail: 'open · Review required.',
        href: '/dashboard/dwm/cases/case-1',
    })
})
