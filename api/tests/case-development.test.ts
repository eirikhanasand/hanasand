import { expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { caseReferences, developmentEntries, repositoryUrl, validGitSignature } from '../src/utils/caseDevelopment.ts'

const repository = 'https://git.example.com/team/app'
const sha = 'a'.repeat(40)
const timestamp = '2026-09-12T12:00:00Z'

test('exact case references, repeated mentions and explicit opaque IDs', () => {
    expect(caseReferences('Fix HA-1 and HA-10; HA-1 again; XHA-2 HA-3x HA-4-extra case_ab12 [case:custom-case]')).toEqual(['HA-1', 'HA-10', 'case_ab12', 'custom-case'])
    expect(caseReferences('HA-0 HA-01')).toEqual([])
})
test('signatures use exact request bytes and reject malformed or forged values', () => {
    const raw = '{ "value": 1 }'
    const signature = createHmac('sha256', 'secret').update(raw).digest('hex')
    expect(validGitSignature('github', raw, { 'x-hub-signature-256': `sha256=${signature}` }, 'secret')).toBe(true)
    expect(validGitSignature('forgejo', raw, { 'x-forgejo-signature': signature }, 'secret')).toBe(true)
    expect(validGitSignature('github', JSON.stringify(JSON.parse(raw)), { 'x-hub-signature-256': `sha256=${signature}` }, 'secret')).toBe(false)
    expect(validGitSignature('github', raw, {}, 'secret')).toBe(false)
    expect(validGitSignature('gitlab', raw, { 'x-gitlab-token': 'secret' }, 'secret')).toBe(true)
    expect(validGitSignature('gitlab', raw, { 'x-gitlab-token': 'wrong!' }, 'secret')).toBe(false)
})
test('commit links use trusted repository URLs, never payload URLs', () => {
    const entries = developmentEntries('forgejo', 'push', { repository: { html_url: repository }, ref: 'refs/heads/main', commits: [{ id: sha, message: 'Fix HA-1\nRelated HA-10', url: 'javascript:alert(1)', author: { name: 'Engineer' }, timestamp }] }, repository)
    expect(entries[0]).toMatchObject({ url: `${repository}/commit/${sha}`, references: ['HA-1', 'HA-10'], author: 'Engineer', state: 'committed' })
    expect(() => developmentEntries('forgejo', 'push', { repository: { html_url: 'https://other.example/team/app' }, commits: [] }, repository)).toThrow()
    expect(() => repositoryUrl('https://user:secret@example.com/team/app')).toThrow()
    expect(() => repositoryUrl('javascript:alert(1)')).toThrow()
})
test('GitHub/Forgejo PRs and GitLab merge requests link references and current state', () => {
    const pull_request = { number: 4, title: 'HA-1: repair', body: 'See HA-10', user: { login: 'author' }, updated_at: timestamp, state: 'closed', merged: true, head: { ref: 'repair' } }
    expect(developmentEntries('github', 'pull_request', { repository: { html_url: repository }, pull_request }, repository)[0]).toMatchObject({ url: `${repository}/pull/4`, state: 'merged', references: ['HA-1', 'HA-10'] })
    expect(developmentEntries('forgejo', 'pull_request', { repository: { html_url: repository }, pull_request }, repository)[0].url).toBe(`${repository}/pulls/4`)
    expect(developmentEntries('gitlab', 'Merge Request Hook', { project: { web_url: repository }, user: { username: 'author' }, object_attributes: { iid: 7, title: 'HA-1 repair', description: '[case:custom-id]', state: 'opened', updated_at: timestamp } }, repository)[0]).toMatchObject({ url: `${repository}/-/merge_requests/7`, state: 'open', references: ['HA-1', 'custom-id'] })
})
