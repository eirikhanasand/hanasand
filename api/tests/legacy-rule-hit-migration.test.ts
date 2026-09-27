import { expect, test } from 'bun:test'
import { allocateHistoricalRuleHits } from '../src/utils/db/legacyHealthRuleHitMigration.ts'

test('allocates the legacy rule total to split rules by the five-minute sample', () => {
    const allocation = allocateHistoricalRuleHits(672235)
    expect(allocation).toEqual([
        { id: 'custom.ad38553bb1214ade9e25.v1', hits: 311122 },
        { id: 'custom.75ab7fc6485c4892b8e1.v1', hits: 325196 },
        { id: 'custom.7304f6447fad4d769764.v1', hits: 35917 },
    ])
    expect(allocation.reduce((total, item) => total + item.hits, 0)).toBe(672235)
})
