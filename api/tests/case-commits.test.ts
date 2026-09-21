import { expect, test } from 'bun:test'
import { commitPage } from '../src/utils/caseCommits.ts'

test('commit cursors retain order and do not repeat commits when new commits arrive', () => {
    const commits = Array.from({ length: 225 }, (_, index) => ({ external_id: index.toString(16).padStart(40, '0'), title: `Commit ${index}`, author: 'Engineer', updated_at: '2026-09-21T00:00:00Z' }))
    const first = commitPage(commits)!
    expect(first.items).toHaveLength(100)
    const second = commitPage([{ ...commits[0], external_id: 'f'.repeat(40) }, ...commits], first.nextCursor!)!
    expect(second.items).toEqual(commits.slice(100, 200))
    const last = commitPage(commits, second.nextCursor!)!
    expect(last.items).toEqual(commits.slice(200))
    expect(last.nextCursor).toBeNull()
    expect(commitPage(commits, 'removed-commit')).toBeNull()
    expect(commitPage([])).toEqual({ items: [], nextCursor: null })
})
