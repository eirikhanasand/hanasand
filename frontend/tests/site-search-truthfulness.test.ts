import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actorItems } from '../src/components/header/siteSearch'

test('header search does not invent an actor result for unavailable or empty TI responses', () => {
    assert.deepEqual(actorItems({ query: 'APT29', status: 'unavailable', mode: 'unavailable' }, 'APT29'), [])
    assert.deepEqual(actorItems({}, 'APT29'), [])
})

test('header search may link an explicit actor only from a ready response', () => {
    assert.deepEqual(actorItems({ query: 'APT29', actor: 'APT29', status: 'ready' }, 'APT29'), [{
        id: 'actor:APT29',
        title: 'APT29',
        detail: 'Open threat intelligence result',
        href: '/ti/APT29',
    }])
})
