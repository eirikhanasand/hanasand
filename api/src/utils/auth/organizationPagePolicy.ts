export const HANASAND_ORGANIZATION_ID = '3e735e7b-4d7f-444d-9806-231fa26cfcec'

// API namespaces used by internal dashboard pages. Keep this explicit so an
// organization role cannot become a blanket grant on unrelated API routes.
const internalPageRoutes = [
    '/admin/audit-events',
    '/article',
    '/articles',
    '/automations',
    '/backup',
    '/blocklist/overview',
    '/certificates',
    '/commercial',
    '/db',
    '/docker',
    '/events',
    '/host-overview',
    '/logs',
    '/mail',
    '/mail-relay',
    '/metrics',
    '/notes',
    '/project',
    '/projects',
    '/rate-limit',
    '/rules',
    '/service-accounts',
    '/share',
    '/system',
    '/test',
    '/tests',
    '/thesis',
    '/thought',
    '/thoughts',
    '/ti',
    '/tools',
    '/traffic',
    '/user',
    '/users',
    '/vm',
    '/vms',
    '/vulnerabilities',
    '/ai',
    '/cases/monitoring',
]

export function canViewHanasandInternalRoute(method: string, route: string) {
    const path = route.split('?')[0].replace(/^\/api(?=\/)/, '').replace(/\/$/, '') || '/'
    const normalizedMethod = method.toUpperCase()
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) return false
    return internalPageRoutes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

export function canViewHanasandInternalPages(membership: {
    organizationId: string
    organizationStatus: string
    membershipStatus: string
    role: string
}) {
    return membership.organizationId === HANASAND_ORGANIZATION_ID
        && membership.organizationStatus === 'active'
        && membership.membershipStatus === 'active'
        && ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'].includes(membership.role.toLowerCase())
}

export function canEditHanasandInternalPages(membership: {
    organizationId: string
    organizationStatus: string
    membershipStatus: string
    role: string
}) {
    return canViewHanasandInternalPages(membership)
        && ['owner', 'admin', 'editor'].includes(membership.role.toLowerCase())
}

export function canAccessHanasandInternalPageRoute(method: string, membership: {
    organizationId: string
    organizationStatus: string
    membershipStatus: string
    role: string
}) {
    return canViewHanasandInternalPages(membership)
        && (['GET', 'HEAD'].includes(method.toUpperCase()) || canEditHanasandInternalPages(membership))
}
