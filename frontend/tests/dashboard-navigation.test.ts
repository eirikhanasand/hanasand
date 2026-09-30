import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getDashboardNavigation, navigationLinks, pinnedNavigation, type NavigationItem } from '../src/utils/layout/dashboardNavigation'
import { organizationPages } from '../src/utils/organizations/pages'
import { canViewHanasandInternalPages, HANASAND_ORGANIZATION_ID } from '../src/utils/organizations/internalPageAccess'

test('organization destinations remain reachable exactly once after regrouping', () => {
    const links = navigationLinks(getDashboardNavigation({ id: 'member' }))
    for (const page of organizationPages) {
        const matches = links.filter(link => link.href === page.href)
        assert.equal(matches.length, 1)
        assert.equal(matches[0].ancestors[0], 'Organization')
    }
})

test('every dropdown has at most five entries, including long pinned lists', () => {
    function check(items: NavigationItem[]) {
        for (const item of items) if (item.items) {
            assert(item.items.length <= 5, item.label)
            check(item.items)
        }
    }
    const sections = getDashboardNavigation({ id: 'admin', canManageOrganizations: true, canViewInternalPages: true, hasVMs: true })
    check(sections)
    const links = navigationLinks(sections)
    const pinned = pinnedNavigation(links)
    check([{ label: 'Pinned', items: pinned }])
    assert.deepEqual(navigationLinks(pinned).map(item => item.href), links.map(item => item.href))
})

test('feeds remain reachable without the removed collection targets entry', () => {
    const links = navigationLinks(getDashboardNavigation({ id: 'admin', canViewInternalPages: true }))
    assert.equal(links.filter(link => link.href === '/ti/sources').length, 1)
    assert.equal(links.some(link => link.href?.startsWith('/ti/domains')), false)
})

test('traffic has separate overview, recent, map, and blocklist destinations', () => {
    const sections = getDashboardNavigation({ id: 'admin', canViewInternalPages: true })
    const logsAndRules = sections.find(item => item.label === 'Logs & rules')
    assert.deepEqual(logsAndRules?.items?.map(item => item.label), ['Logs', 'Traffic', 'Rules'])

    const traffic = logsAndRules?.items?.find(item => item.label === 'Traffic')
    assert.deepEqual(traffic?.items?.map(item => item.label), ['Overview', 'Recent traffic', 'Live map', 'Blocklist'])
    assert.deepEqual(traffic?.items?.map(item => item.href), ['/traffic', '/traffic/recent', '/traffic/map', '/traffic/blocklist'])
})

test('Hanasand owners and editors get internal pages from organization membership', () => {
    for (const role of ['owner', 'editor']) {
        assert.equal(canViewHanasandInternalPages([{ id: HANASAND_ORGANIZATION_ID, role, lifecycleStatus: 'active' }]), true)
    }
    assert.equal(canViewHanasandInternalPages([{ id: HANASAND_ORGANIZATION_ID, role: 'reader', lifecycleStatus: 'active' }]), true)
    assert.equal(canViewHanasandInternalPages([{ id: HANASAND_ORGANIZATION_ID, role: 'editor', lifecycleStatus: 'archived' }]), false)
    assert.equal(canViewHanasandInternalPages([{ id: 'another-org', role: 'owner', lifecycleStatus: 'active' }]), false)

    const links = navigationLinks(getDashboardNavigation({
        id: 'sindre',
        canManageOrganizations: true,
        canViewInternalPages: true, canReviewIntel: true, hasVMs: true,
    }))
    for (const path of ['/logs/realtime', '/traffic', '/ti/timeliness', '/db', '/management/users', '/management/audit', '/management/organizations', '/vms', '/system/virtual-machines']) {
        assert.equal(links.some(link => link.href === path), true, path)
    }
})
