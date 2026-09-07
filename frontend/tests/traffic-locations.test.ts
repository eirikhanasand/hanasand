import assert from 'node:assert/strict'
import { countryIsoForTrafficRecord, hydrateCountries } from '../src/utils/monitoring/liveTrafficMap'
import type { TrafficRecord } from '../src/utils/monitoring/types'
const record = { id: 1, domain: 'example.no', path: '/', timestamp: new Date().toISOString() } as TrafficRecord
assert.equal(countryIsoForTrafficRecord(record), '', 'A destination domain does not identify the visitor location')
assert.deepEqual(hydrateCountries([record]), {}, 'Missing geography must not generate map activity')
const known = { ...record, country_iso: 'US' }
assert.equal(countryIsoForTrafficRecord(known), 'US')
assert.equal(hydrateCountries([known]).US.count, 1)
assert.deepEqual(hydrateCountries([known]), hydrateCountries([known]), 'Snapshots replace counts instead of replaying traffic')
console.log('PASS: only recorded locations appear, unknown locations stay unknown, snapshots are repeatable.')
