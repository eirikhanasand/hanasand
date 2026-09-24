import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation'
import { organizationPages } from '../src/utils/organizations/pages'

test('organization destinations remain reachable exactly once after regrouping', () => {
    const links = navigationLinks(getDashboardNavigation({ id: 'member', isAdmin: false, canManageSystem: false, canManageContent: false }))
    for (const page of organizationPages) {
        const matches = links.filter(link => link.href === page.href)
        assert.equal(matches.length, 1)
        assert.equal(matches[0].ancestors[0], 'Organization')
    }
})
