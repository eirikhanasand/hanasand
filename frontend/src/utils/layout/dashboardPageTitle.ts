import { getDashboardNavigation, navigationLinks } from './dashboardNavigation'
import { canonicalAppPath } from '../routes/appRoutes'

// Labels are route metadata, independent of which links a user can access.
const pages = navigationLinks(getDashboardNavigation({
    id: '', isAdmin: true, canManageSystem: true, canManageContent: true, hasVMs: true,
})).sort((a, b) => b.href.length - a.href.length)

export function dashboardPageTitle(path: string): string {
    const canonical = canonicalAppPath(path).replace(/\/$/, '')
    const page = pages.find(({ href }) => canonical === href || canonical.startsWith(`${href}/`))
    if (page) return page.label
    return canonical.split('/').filter(Boolean).at(-1)?.replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || 'Overview'
}
