import { expect, test } from 'bun:test'
import { normalizeLegacyEventRows } from '../src/utils/db/browse.ts'

test('database previews show the generic parser version for historical events', () => {
    expect(normalizeLegacyEventRows([
        { id: 'old', parser_version: 'mill.v1' },
        { id: 'current', parser_version: 'event.v1' },
    ], ['id', 'parser_version'])).toEqual([
        { id: 'old', parser_version: 'event.v1' },
        { id: 'current', parser_version: 'event.v1' },
    ])
    expect(normalizeLegacyEventRows([{ id: 'other-table', value: 'mill.v1' }], ['id', 'value']))
        .toEqual([{ id: 'other-table', value: 'mill.v1' }])
})
