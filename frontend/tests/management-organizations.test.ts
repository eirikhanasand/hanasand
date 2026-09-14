import { expect, test } from 'bun:test'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation'
test('Organizations under Management requires explicit Hanasand access', () => {
    const access = { id: 'admin', isAdmin: true, canManageSystem: true, canManageContent: true }
    const links = (allowed = false) => navigationLinks(getDashboardNavigation({ ...access, canManageOrganizations: allowed }))
    expect(links().some(link => link.href === '/management/organizations')).toBe(false)
    expect(links(true).find(link => link.href === '/management/organizations')?.ancestors).toEqual(['Administration', 'Management'])
    expect(links().some(link => link.href === '/organizations')).toBe(true)
})
