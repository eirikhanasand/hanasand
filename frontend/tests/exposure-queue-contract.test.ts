import assert from 'node:assert/strict'
import { normalizeExposureQueue } from '../src/app/exposureQueue'

const queue = normalizeExposureQueue({
    status: 'live',
    items: [
        { id: 'capture-1', actor: 'Actor One', company: 'Company One' },
        { id: 'capture-2', company: 'Company Two' },
        { company: 'Company Three' },
    ],
})

assert.deepEqual(queue.items.map(item => item.id), ['capture-1'])
assert.equal(queue.items[0]?.status, 'unverified')

const names = [
    ['Wellness%20Partners%20network(combined%20revenue)', 'Wellness Partners network(combined revenue)'],
    ['Asfaltos%20y%20Pavimentos%20S.A.%20(Asfalpasa)', 'Asfaltos y Pavimentos S.A. (Asfalpasa)'],
    ['M%C3%BCller%20%26%20Sons', 'Müller & Sons'],
    ['https%3A%2F%2Fexample.com%2F', 'https://example.com/'],
    ['100% Wellness%20Partners', '100% Wellness Partners'],
    ['Company%ZZ%20Name%FF', 'Company%ZZ Name%FF'],
    ['A+B Partners (50%)', 'A+B Partners (50%)'],
    ['Literal%2520Name', 'Literal%20Name'],
]
for (const [company, expected] of names) {
    const normalized = normalizeExposureQueue({ items: [{ id: 'capture%20id', actor: 'Actor', company }] })
    assert.equal(normalized.items[0]?.company, expected)
    assert.equal(normalized.items[0]?.id, 'capture%20id')
}
