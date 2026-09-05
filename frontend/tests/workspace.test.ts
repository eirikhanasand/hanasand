import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readSheets, writeSheets, identifiedSheets, sheetChanges, tables, writeTable, cellValue, reshape, columnName } from '../src/app/thesis/workspace'

test('sheets preserve existing markdown and round-trip titles, prose, tables and sizes', () => {
    const sheets = readSheets('# Existing **thesis**', '## Existing content\n\nKeep this.\n')
    assert.equal(sheets.length, 4)
    assert.equal(sheets[0].body, '## Existing content\n\nKeep this.\n')
    sheets[1] = { title: '# **Timetable** -->', body: 'Before\n\n| Hours | Total |\n| --- | --- |\n| 2 | =SUMMARIZE(A2:A2) |\n\nAfter\n' }
    assert.deepEqual(readSheets(sheets[0].title, writeSheets(sheets)), sheets)
    const invalid = 'Before\n\n<!-- thesis-sheet:Plan title:%ZZ -->\nKeep this content'
    assert.equal(readSheets('Title', invalid)[0].body, invalid)
    const code = '```md\n<!-- thesis-sheet:Plan title:fake -->\n```'
    assert.equal(readSheets('Title', code)[0].body, code)
    const data = { cells: [['Task', 'Hours'], ['line one\nline two | \\ & <br> &#124;', '2']], widths: [300, 180], heights: [48, 100] }
    const md = 'Before\n\n' + writeTable(data) + '\nAfter'
    const parsed = tables(md)
    assert.equal(parsed.length, 1)
    assert.deepEqual(parsed[0].data, data)
    assert.equal(md.slice(parsed[0].end), '\nAfter')
    const resized = tables(writeTable({ ...data, heights: [48, 78] }))[0].data
    assert.deepEqual(resized.heights, [48, 78])
    assert.equal(tables('| A |\n| --- |\n| 1 |\n<!-- thesis-table:{"heights":[null,78]} -->\n')[0].data.heights[0], 48)
    assert.equal(tables('```md\n' + writeTable(data) + '\n```').length, 0)
    assert.doesNotThrow(() => tables('| A |\n| --- |\n| &#999999999; |'))
})

test('SUMMARIZE supports both directions, nested formulas, invalid ranges and structural edits', () => {
    const cells = [['Hours', 'Other', 'Total'], ['2', '3', '=SUMMARIZE(A2:B2)'], ['-1.5', 'text', '=SUMMARIZE(A2:A3)'], ['=SUMMARIZE(C2:C3)', '', '=SUMMARIZE(AA1:AA2)']]
    assert.equal(cellValue(cells, 1, 2), '5')
    assert.equal(cellValue(cells, 2, 2), '0.5')
    assert.equal(cellValue(cells, 3, 0), '5.5')
    assert.equal(cellValue(cells, 3, 2), '#REF!')
    assert.equal(cellValue([['=SUMMARIZE(A1:A1)']], 0, 0), '#CYCLE!')
    assert.equal(cellValue([['=SUMMARIZE(B1:B1)', '=SUMMARIZE(A1:A1)']], 0, 0), '#CYCLE!')
    assert.equal(cellValue([['=evil()']], 0, 0), '#FORMULA!')
    assert.equal(columnName(26), 'AA')
    assert.equal(cellValue([['2', '3', '=SUMMARIZE(B1:A1)']], 0, 2), '5')
    const data = { cells, widths: [], heights: [] }
    const inserted = reshape(data, 'row', 1, false)
    assert.equal(cellValue(inserted.cells, 2, 2), '5')
    assert.equal(inserted.cells[2][2], '=SUMMARIZE(A3:B3)')
    const removed = reshape(data, 'column', 0, true)
    assert.equal(cellValue(removed.cells, 1, 1), '#REF!')
})

test('sheet metadata preserves deletion, arbitrary markdown and stable history identity', () => {
    const initial = identifiedSheets('# Thesis', 'Keep this\n\n<!-- thesis-sheet:Plan title:example -->\n')
    const next = [...initial.slice(1), { id: 'notes', name: 'Notes', title: '# Notes', body: '😀\n\n<!-- thesis-workspace:2 example -->\n' }]
    assert.deepEqual(identifiedSheets('# Thesis', writeSheets(next)), next)
    assert.deepEqual(sheetChanges(initial, next).map(change => change.before?.id || change.after?.id), ['Overview', 'notes'])
    assert.deepEqual(identifiedSheets('# Thesis', writeSheets([next[3]])), [next[3]])
})
