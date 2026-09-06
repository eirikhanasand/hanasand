import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { expectedWeek, norwegianHolidays } from '../src/app/thesis/norwegianCalendar'
import { activityError, isoWeek, timetable, validActivityLog, weekDates, type ActivityLog } from '../src/app/thesis/timetableData'
import { readSheets, writeSheets, sheetChanges, type TableData } from '../src/app/thesis/workspace'
const data: TableData = { cells: [['Week', 'Research', 'Development', 'Total'], ...[...Array.from({ length: 25 }, (_, i) => i + 28), ...Array.from({ length: 22 }, (_, i) => i + 1)].map(week => [String(week), '', '', '']), ['Total', '', '', '']], widths: [], heights: [] }
const activity = { id: 'one', date: '2026-07-06', hours: 1.25, category: 'Research', description: 'Read a paper\nAnd took notes æøå' }

test('ISO dates cross calendar years correctly and include logged work in week53', () => {
    assert.deepEqual(isoWeek('2027-01-01'), { year: 2026, week: 53, key: '2026-W53' })
    assert.deepEqual(isoWeek('2027-01-04'), { year: 2027, week: 1, key: '2027-W01' })
    assert.deepEqual(weekDates(2026, 28), { start: '2026-07-06', end: '2026-07-12' })
    assert.equal(timetable(data, { startYear: 2026, activities: [] }).weeks.length, 47)
})
test('totals derive from dated entries; removing one changes only its week; dates outside the plan remain visible', () => {
    const log: ActivityLog = { startYear: 2026, activities: [activity, { ...activity, id: 'two', hours: 2.5, category: 'Development' }, { ...activity, id: 'three', date: '2027-01-01', hours: .1 }, { ...activity, id: 'four', date: '2027-06-15', hours: .2 }] }
    const model = timetable(data, log)
    assert.deepEqual(model.weeks[0].values, ['1.25', '2.5', '3.75'])
    assert.deepEqual(model.totals, ['1.55', '2.5', '4.05'])
    assert.equal(model.weeks.find(week => week.key === '2026-W53')?.values.at(-1), '0.1')
    assert.equal(model.weeks.at(-1)?.key, '2027-W24')
    const removed = timetable(data, { ...log, activities: log.activities.filter(item => item.id !== 'two') })
    assert.equal(removed.weeks[0].values.at(-1), '1.25')
})
test('imported totals remain distinct from activity evidence and source table is never mutated', () => {
    const source = { ...data, cells: data.cells.map(row => [...row]) }
    source.cells[1] = ['28', '5', '', '5']
    const before = JSON.stringify(source)
    const model = timetable(source, { startYear: 2026, activities: [activity] })
    assert.equal(model.weeks[0].legacy, true)
    assert.equal(model.weeks[0].values.at(-1), '6.25')
    assert.equal(JSON.stringify(source), before)
})
test('activity metadata survives shared persistence/history and rejects malformed entries', () => {
    const before = [{ id: 'Timetable', title: '# Timetable', body: 'Preserve prose' }]
    const after = [{ ...before[0], activityLog: { startYear: 2026, activities: [activity] } }]
    assert.deepEqual(readSheets('# Thesis', writeSheets(after)), after)
    assert.equal(sheetChanges(before, after).length, 1)
    assert.equal(validActivityLog({ startYear: 2026, activities: [activity, activity] }), false)
    assert.equal(validActivityLog({ startYear: 2026, activities: [{ ...activity, date: '2026-02-30' }] }), false)
    assert.equal(validActivityLog({ startYear: 2026, activities: [{ ...activity, hours: -1 }] }), false)
    assert.equal(validActivityLog({ startYear: 2026, activities: [{ ...activity, hours: 1.001 }] }), false)
    assert.match(activityError({ ...activity, id: 'other', hours: 23 }, [activity]), /24 hours/)
    assert.equal(activityError({ ...activity, hours: 24 }, [activity]), '')
})

test('expected hours use planned rows and weekday Norwegian holidays without double-counting overlaps', () => {
    const model = timetable(data, { startYear: 2026, activities: [] })
    assert.equal(model.plannedWeeks, 47)
    assert.equal(model.expectedHours, 1063.5)
    assert.equal(expectedWeek('2026-12-14', 51, 2026, true).hours, 0)
    assert.equal(expectedWeek('2026-12-28', 53, 2026, true).hours, 0)
    assert.equal(expectedWeek('2027-03-22', 12, 2026, true).hours, 22.5)
    assert.equal(expectedWeek('2027-03-29', 13, 2026, true).hours, 30)
    assert.equal(expectedWeek('2027-05-17', 20, 2026, true).hours, 30)
    assert.equal(norwegianHolidays(2027).get('2027-05-17'), 'Constitution Day / Whit Monday')
    assert.equal(expectedWeek('2027-04-26', 17, 2026, true).hours, 37.5)
    const source = { ...data, cells: data.cells.filter((_, row) => row !== 1) }
    assert.equal(timetable(source, { startYear: 2026, activities: [activity] }).expectedHours, model.expectedHours - 12)
    assert.equal(timetable(source, { startYear: 2026, activities: [activity] }).weeks.find(week => week.key === '2026-W28')?.expected, 0)
})
