import { expect, test } from 'bun:test'
import { shareManagedNames } from '../src/utils/vms/shareManagement.ts'

test('only share-assigned VMs are managed, including warm-pool assignments', () => {
    const managed = shareManagedNames(['project-alpha', 'project-beta', ''], [
        { name: 'project-alpha' },
        { name: 'unclaimed-abcdef', config: { 'user.hanasand.claimed_name': 'project-beta' } },
        { name: 'cashflow' },
        { name: 'unclaimed-unused' },
        { name: 'unrelated', config: { 'user.hanasand.claimed_name': 'non-share-owner' } },
    ])
    expect([...managed]).toEqual(['project-alpha', 'unclaimed-abcdef'])
    expect([...shareManagedNames([], [{ name: 'project-alpha' }])]).toEqual([])
})
