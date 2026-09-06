import { test } from 'node:test'
import assert from 'node:assert/strict'
import { navigateTable, type PendingTable } from '../src/app/thesis/tableNavigation'

const data = { cells: [['Title', 'Total'], ['', '=SUMMARIZE(A1:A1)']], widths: [180, 240], heights: [48, 60] }

test('all four edges are temporary and restore cells, formulas and dimensions', () => {
    for (const [target, back] of [[{ row: -1, col: 0 }, { row: 1, col: 0 }], [{ row: 2, col: 0 }, { row: 1, col: 0 }], [{ row: 1, col: -1 }, { row: 1, col: 1 }], [{ row: 1, col: 2 }, { row: 1, col: 1 }]]) {
        const next = navigateTable({ data }, target, true)
        assert.ok(next.data.cells.length * next.data.cells[0].length > 4)
        assert.deepEqual(navigateTable(next, back).data, data)
    }
})

test('repeated edge presses keep only one empty provisional row or column', () => {
    let pending: PendingTable = { data }
    for (let i = 0; i < 20; i++) {
        pending = navigateTable(pending, { row: pending.data.cells.length, col: 0 }, true)
        assert.equal(pending.data.cells.length, 3)
    }
    pending = navigateTable(pending, { row: 1, col: 0 })
    for (let i = 0; i < 20; i++) {
        pending = navigateTable(pending, { row: 1, col: pending.data.cells[0].length }, true)
        assert.equal(pending.data.cells[0].length, 3)
    }
    assert.deepEqual(navigateTable(pending, { row: 1, col: 1 }).data, data)
})
