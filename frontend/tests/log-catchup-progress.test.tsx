// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import LogCatchupProgress, { type CatchupProgress } from '../src/app/dashboard/logs/catchupProgress'

const now = '2026-09-19T12:00:00Z'
const progress: CatchupProgress = { remaining: 3000, processed: 1000, total: 4000, rate: 50, estimated_seconds: 60, updated_at: now }
const render = (value: CatchupProgress | null) => renderToStaticMarkup(<LogCatchupProgress progress={value} now={now} />)
test('measured progress shows remaining count, percent and ETA', () => {
    const html = render(progress)
    expect(html).toContain('3,000 logs remaining')
    expect(html).toContain('aria-valuenow="25"')
    expect(html).toContain('About 1 min remaining')
    expect(html).toContain('25.0% · ')
    expect(html).toContain(`dateTime="${now}"`)
    expect(html).toContain('Historical log lag')
    expect(html).toContain('Checked')
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
test('small backlogs and unknown counts stay hidden', () => {
    expect(render({ ...progress, remaining: 1000 })).toBe('')
    expect(render({ ...progress, remaining: 999 })).toBe('')
    expect(render(null)).toBe('')
    expect(render({ ...progress, remaining: 1001 })).toContain('Historical log lag')
})
