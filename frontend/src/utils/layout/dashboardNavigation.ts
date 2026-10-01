export type NavigationItem = {
    label: string
    href?: string
    items?: NavigationItem[]
    visible?: boolean
}

export type NavigationAccess = {
    id: string
    canManageOrganizations?: boolean
    canViewInternalPages?: boolean
    hasContentOrganization?: boolean
    hasHanasandOrganization?: boolean
    thesisSheets?: Array<{ label: string, href: string }>
    hasVMs?: boolean
    canReviewIntel?: boolean
}

export function getDashboardNavigation(access: NavigationAccess): NavigationItem[] {
    const {
        id,
        hasContentOrganization = false,
        hasHanasandOrganization = false,
        thesisSheets = [],
        hasVMs = false,
    } = access
    const isAdmin = access.canViewInternalPages === true
    const canManageContent = access.canViewInternalPages === true
    const canManageOrganizations = access.canManageOrganizations === true
    const canManageSystem = access.canViewInternalPages === true
    const canReviewIntel = access.canViewInternalPages === true
    const link = (label: string, href: string, visible = true): NavigationItem => ({ label, href, visible })
    const group = (label: string, items: NavigationItem[], visible = true): NavigationItem => ({ label, items, visible })
    const sections = [
        group('Security & intelligence', [
            group('Investigations', [
                link('Cases', '/cases'),
                link('Threat Search', '/ti'),
                link('Browser', '/browser'),
            ]),
            group('Intelligence', [
                link('Latest Activity', '/ti/activity', isAdmin),
                link('Actors', '/findings/actors'),
                link('Actor Profiles', '/ti/profiles', isAdmin),
            ]),
            group('Monitoring', [
                link('Watchlists', '/watchlists'),
                link('Findings', '/findings'),
                link('Delivery', '/findings/actions'),
            ]),
            group('Collection', [
                link('Feeds', '/ti/sources', isAdmin),
                link('Collection', '/ti/runs', isAdmin),
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
            ]),
            group('Traffic', [
                link('Overview', '/traffic', canManageSystem),
                link('Recent traffic', '/traffic/recent', canManageSystem),
                link('Live map', '/traffic/map', canManageSystem),
                link('Blocklist', '/traffic/blocklist', canManageSystem),
            ]),
            group('Rules', [
                link('Match Rules', '/rules/match'),
                link('Analysis Rules', '/rules/analysis'),
                link('Detection Rules', '/rules/detection'),
            ]),
        ]),
        group('Infrastructure', [
            group('System', [
                link('Overview', '/system'),
                link('Virtual machines', '/system/virtual-machines', hasVMs),
                link('Containers', '/system/containers'),
                link('Hosts', '/system/hosts', isAdmin),
            ]),
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
        group('Content', [
            group('Writing', [
                link('Notes', '/notes', canManageContent || hasContentOrganization),
                link('Articles', '/content/articles', canManageContent || hasContentOrganization),
                link('Thoughts', '/content/thoughts', canManageContent || hasContentOrganization),
            ]),
            group('Media', [
                link('Gallery', '/gallery'),
                link('Uploads', '/upload'),
            ]),
            group('Code', [
                link('Projects', '/projects', isAdmin),
                link('Shares', '/shares'),
            ]),
            nestedGroup('Thesis', thesisSheets.length
                ? thesisSheets.map(sheet => link(sheet.label, sheet.href))
                : [link('Overview', '/thesis')], hasHanasandOrganization),
        ]),
        group('Communication', [
            link('Mail', '/mail'),
            link('Support Chats', '/support'),
        ]),
        group('Organization', [
            link('Overview', '/organizations'),
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
            group('Integrations', [
                link('Integrations', '/findings/delivery'),
            ]),
            group('Monitoring & activity', [
                link('Alerts & Cases', '/organizations/alerts'),
                link('Activity', '/organizations/activity'),
            ]),
        ]),
        group('Administration', [
            link('Organizations', '/management/organizations', canManageOrganizations),
            link('Users', '/management/users', isAdmin),
            link('Audit Log', '/management/audit', isAdmin),
        ]),
        group('Resources', [link('API Docs', '/api'), link('OpenAPI JSON', '/api/openapi')]),
        group('Account', [
            link('Profile', `/profile/${id}`),
            link('Security', `/profile/${id}/security`),
            link('Sessions', `/profile/${id}/sessions`),
            link('SSH Keys', `/profile/${id}/ssh-keys`),
            link('Tickets', `/profile/${id}/support`),
        ]),
    ]
    function nestedGroup(label: string, items: NavigationItem[], visible = true): NavigationItem {
        if (items.length <= 5) return group(label, items, visible)
        return group(label, [...items.slice(0, 4), nestedGroup('More sheets', items.slice(4))], visible)
    }
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
