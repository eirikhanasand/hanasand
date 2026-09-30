export const HANASAND_ORGANIZATION_ID = '3e735e7b-4d7f-444d-9806-231fa26cfcec'

const internalReadRoutes = new Set([
    '/admin/audit-events',
    '/admin/audit-events/:id',
    '/automations',
    '/automations/:id',
    '/backup',
    '/backup/files',
    '/blocklist/overview',
    '/db',
    '/db/browse',
    '/db/health',
    '/db/rows',
    '/docker',
    '/events',
    '/host-overview',
    '/logs',
    '/logs/errors',
    '/logs/metrics',
    '/logs/realtime',
    '/logs/search',
    '/logs/services',
    '/logs/services/summary',
    '/metrics',
    '/rate-limit/keys',
    '/rate-limit/settings',
    '/service-accounts',
    '/system/cron',
    '/system/events',
    '/system/events/:id',
    '/system/snapshot',
    '/system/storage',
    '/system/updates',
    '/tools/execution-targets',
    '/traffic/domains',
    '/traffic/ips',
    '/traffic/live',
    '/traffic/metrics',
    '/traffic/recent',
    '/traffic/records',
    '/traffic/summary',
    '/traffic/tps',
    '/traffic/uas',
    '/vm/metrics',
    '/vm/metrics/:id',
    '/vms',
    '/vms/:user',
    '/vms/access/:user',
    '/vms/names',
    '/vulnerabilities',
    '/vulnerabilities/web-scan',
])

export function canViewHanasandInternalRoute(method: string, route: string) {
    const path = route.split('?')[0].replace(/^\/api(?=\/)/, '')
    return method.toUpperCase() === 'GET' && internalReadRoutes.has(path)
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
        && ['owner', 'editor'].includes(membership.role.toLowerCase())
}
