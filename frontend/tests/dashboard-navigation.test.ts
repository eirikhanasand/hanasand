import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getDashboardNavigation, navigationLinks, pinnedNavigation, type NavigationItem } from '../src/utils/layout/dashboardNavigation'
import { organizationPages } from '../src/utils/organizations/pages'

test('organization destinations remain reachable exactly once after regrouping', () => {
    const links = navigationLinks(getDashboardNavigation({ id: 'member', isAdmin: false, canManageSystem: false, canManageContent: false }))
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
    const sections = getDashboardNavigation({ id: 'admin', isAdmin: true, canManageOrganizations: true, canManageSystem: true, canManageContent: true, hasVMs: true })
    check(sections)
    const links = navigationLinks(sections)
    const pinned = pinnedNavigation(links)
    check([{ label: 'Pinned', items: pinned }])
    assert.deepEqual(navigationLinks(pinned).map(item => item.href), links.map(item => item.href))
})
