// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import LogCatchupProgress, { type CatchupProgress } from '../src/app/dashboard/logs/catchupProgress'

const now = '2026-09-19T12:00:00Z'
const progress: CatchupProgress = { remaining: 3000, processed: 1000, total: 4000, rate: 50, estimated_seconds: 60, updated_at: now }
const render = (value: CatchupProgress | null, catchingUp = true) => renderToStaticMarkup(<LogCatchupProgress progress={value} catchingUp={catchingUp} now={now} />)
test('measured progress shows remaining count, percent and ETA', () => {
    const html = render(progress)
    expect(html).toContain('3,000 logs remaining')
    expect(html).toContain('aria-valuenow="25"')
    expect(html).toContain('About 1 min remaining')
    expect(html).toContain('25.0% · ')
    expect(html).toContain(`dateTime="${now}"`)
    expect(html).toContain('Last refreshed')
    expect(html).not.toContain('Results and counters will update')
})
test('missing, paused and stale measurements do not invent an ETA', () => {
    expect(render(null)).not.toContain('aria-valuenow=')
    expect(render({ ...progress, rate: null, estimated_seconds: null })).toContain('Estimating time remaining')
    const stale = render({ ...progress, updated_at: '2026-09-19T11:57:00Z' })
    expect(stale).toContain('Time remaining unavailable')
    expect(stale).toContain(`dateTime="${now}"`)
    expect(stale).not.toContain('About 1 min')
})
test('an empty range finishes at 100 percent then hides after cursors catch up', () => {
    const done = { ...progress, remaining: 0, processed: 0, total: 0, estimated_seconds: 0 }
    expect(render(done)).toContain('aria-valuenow="100"')
    expect(render(done)).toContain('Finishing catch-up')
    expect(render(done, false)).toBe('')
})
