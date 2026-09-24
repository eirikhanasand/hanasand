export type NavigationItem = {
    label: string
    href?: string
    items?: NavigationItem[]
    visible?: boolean
}

export type NavigationAccess = {
    id: string
    canManageOrganizations?: boolean
    isAdmin: boolean
    canManageSystem: boolean
    canManageContent: boolean
    hasContentOrganization?: boolean
    hasVMs?: boolean
    canReviewIntel?: boolean
}

export function getDashboardNavigation({ id, isAdmin, canManageOrganizations = false, canManageSystem, canManageContent, hasContentOrganization = false, canReviewIntel = isAdmin, hasVMs = false }: NavigationAccess): NavigationItem[] {
    const link = (label: string, href: string, visible = true): NavigationItem => ({ label, href, visible })
    const group = (label: string, items: NavigationItem[]): NavigationItem => ({ label, items })
    const sections = [
        link('Overview', '/dashboard'),
        group('Security & intelligence', [
            group('Investigations', [
                link('Cases', '/cases'),
                link('Threat Search', '/ti'),
                link('Browser', '/browser'),
            ]),
            group('Intelligence', [
                link('Latest Activity', '/ti/activity', isAdmin),
                link('Actors', '/dwm/actors'),
                link('Actor Profiles', '/ti/enrichment', isAdmin),
            ]),
            group('Monitoring', [
                link('Watchlists', '/dwm/watchlists'),
                link('Dark Web Monitoring', '/dwm'),
                link('Monitoring Actions', '/dwm/actions'),
            ]),
            group('Collection', [
                link('Feeds', '/ti/sources', isAdmin),
                link('Collection Runs', '/ti/runs', isAdmin),
                link('Delivery Health', '/ti/timeliness', canReviewIntel),
            ]),
            group('Security tools', [
                link('Security Scanner', canManageSystem ? '/scanner' : '/solutions/scanner'),
                link('Exposure Lookup', '/pwned'),
                link('Endpoint Checks', '/test'),
            ]),
        ]),
        group('Logs & rules', [
            group('Logs', [
                link('Log Dashboard', '/logs', canManageSystem),
                link('Realtime', '/logs/realtime', canManageSystem),
                link('Search', '/logs/search', canManageSystem),
                link('Errors', '/logs/errors', canManageSystem),
                link('Traffic', '/traffic', canManageSystem),
            ]),
            group('Rules', [
                link('Match Rules', '/mill/rules/match'),
                link('Analysis Rules', '/mill/rules/analysis'),
                link('Detection Rules', '/mill/rules/detection'),
            ]),
        ]),
        group('Infrastructure', [
            link('System Overview', '/system'),
            group('Compute', [
                link('Virtual Machines', '/vms', hasVMs),
                link('Host Updates', '/system/updates', isAdmin),
            ]),
            group('Health', [
                link('AI Metrics', '/system/ai', canManageSystem),
                link('Vulnerabilities', '/vulnerabilities', canManageSystem),
                link('Rate Limits', '/system/rates', isAdmin),
                link('Load Testing', '/load-testing', canManageSystem),
            ]),
            group('Data management', [
                link('Database', '/db', isAdmin),
                link('Backups', '/db/backups', isAdmin),
            ]),
        ]),
        group('Automation', [
            link('Health Checks', '/automation/health'),
            link('Cron Jobs', '/automation/cron'),
        ]),
        group('Workspace', [
            link('Projects', '/projects', isAdmin),
            group('Writing', [
                link('Notes', '/notes', canManageContent || hasContentOrganization),
                link('Articles', '/content/articles', canManageContent || hasContentOrganization),
                link('Thoughts', '/content/thoughts', canManageContent || hasContentOrganization),
                link('Thesis', '/content/thesis', isAdmin),
            ]),
            group('Media & sharing', [
                link('Media Library', '/gallery'),
                link('Uploads', '/upload'),
                link('Shares', '/shares'),
            ]),
            link('Content Management', '/content', canManageContent),
        ]),
        group('Communication', [
            link('Mail', '/mail'),
            link('Support Chats', '/support'),
            link('Helpdesk', '/helpdesk', isAdmin),
        ]),
        group('Organization', [
            link('Organization Overview', '/organizations'),
            group('Settings & billing', [
                link('Organization Settings', '/organizations/settings'),
                link('Privacy & Retention', '/organizations/privacy'),
                link('Subscription', '/subscription'),
            ]),
            group('Access & credentials', [
                link('Team', '/organizations/team'),
                link('API Keys', '/organizations/api-keys'),
                link('Service Accounts', '/management/service-accounts', isAdmin),
            ]),
            group('Integrations & delivery', [
                link('Integrations', '/dwm/delivery'),
                link('Destinations', '/organizations/destinations'),
                link('Delivery History', '/organizations/delivery'),
            ]),
            group('Monitoring & activity', [
                link('Organization Watchlists', '/organizations/watchlists'),
                link('Alerts & Cases', '/organizations/alerts'),
                link('Activity', '/organizations/activity'),
            ]),
        ]),
        group('Platform administration', [
            link('All Organizations', '/management/organizations', canManageOrganizations),
            link('Platform Users', '/management/users', isAdmin),
            link('Platform Roles', '/management/roles', isAdmin),
            link('System Audit Log', '/management/audit', isAdmin),
        ]),
        group('Help & developer resources', [link('API Docs', '/api'), link('OpenAPI JSON', '/api/openapi')]),
        group('Account', [
            link('Profile', `/profile/${id}`),
            link('Security', `/profile/${id}/security`),
            link('Sessions', `/profile/${id}/sessions`),
            link('Certificates', `/profile/${id}/certificates`),
            link('My Support Tickets', `/profile/${id}/support`),
        ]),
    ]
    const permitted = (items: NavigationItem[]): NavigationItem[] => items
        .filter(item => item.visible !== false)
        .map(item => item.items ? { ...item, items: permitted(item.items) } : item)
        .filter(item => !item.items || item.items.length > 0)
    return permitted(sections)
}

export function navigationLinks(items: NavigationItem[], ancestors: string[] = []): Array<{ label: string, href: string, ancestors: string[] }> {
    return items.flatMap(item => item.items
        ? navigationLinks(item.items, [...ancestors, item.label])
        : item.href ? [{ label: item.label, href: item.href, ancestors }] : [])
}

export function pinnedNavigation(items: NavigationItem[]): NavigationItem[] {
    if (items.length <= 5) return items
    return [...items.slice(0, 4), { label: 'More pins', items: pinnedNavigation(items.slice(4)) }]
}
