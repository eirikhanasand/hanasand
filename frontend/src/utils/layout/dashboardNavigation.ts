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
    hasVMs?: boolean
    canReviewIntel?: boolean
}

export function getDashboardNavigation({ id, isAdmin, canManageOrganizations = false, canManageSystem, canManageContent, canReviewIntel = isAdmin, hasVMs = false }: NavigationAccess): NavigationItem[] {
    const link = (label: string, href: string, visible = true): NavigationItem => ({ label, href, visible })
    const group = (label: string, items: NavigationItem[]): NavigationItem => ({ label, items })
    const sections = [
        group('Security operations', [
            link('Overview', '/dashboard'),
            group('Investigations', [
                link('Threat Search', '/ti'),
                link('Cases', '/cases'),
                link('Browser', '/browser'),
                link('Monitoring actions', '/dwm/actions'),
            ]),
            group('Monitoring', [
                link('Dark web monitoring', '/dwm'),
                link('Actors', '/dwm/actors'),
                link('Watchlists', '/dwm/watchlists'),
                group('Rules', [
                    link('Match filter', '/mill/rules/match'),
                    link('Analysis filter', '/mill/rules/analysis'),
                    link('Detection filter', '/mill/rules/detection'),
                ]),
                link('Integrations', '/dwm/delivery'),
            ]),
            group('Security tools', [
                link('Security Scanner', canManageSystem ? '/scanner' : '/solutions/scanner'),
                link('Exposure Lookup', '/pwned'),
                link('Endpoint Checks', '/test'),
            ]),
        ]),
        group('Threat intelligence', [
            group('Intelligence', [
                link('Latest Activity', '/ti/activity', isAdmin),
                link('Attacks', '/ti/attacks', isAdmin),
                link('Actor Profiles', '/ti/enrichment', isAdmin),
            ]),
            group('Collection', [
                link('Overview', '/ti/control', isAdmin),
                link('Sources', '/ti/sources', isAdmin),
                link('Watched Entities', '/ti/domains', isAdmin),
                link('Collection Runs', '/ti/runs', isAdmin),
            ]),
            group('Quality & oversight', [
                link('Evaluation', '/ti/evaluation', canReviewIntel),
                link('Timeliness', '/ti/timeliness', canReviewIntel),
            ]),
        ]),
        group('Automation', [
            link('Health Checks', '/automation/health'),
            link('Cron Jobs', '/automation/cron'),
        ]),
        group('Infrastructure', [
            link('Overview', '/system'),
            group('Compute', [
                link('Virtual Machines', '/vms', hasVMs),
                link('Host Updates', '/system/updates', isAdmin),
            ]),
            group('Observability', [
                link('Traffic', '/traffic', canManageSystem),
                link('Logs', '/logs', isAdmin),
                link('AI Metrics', '/system/ai', canManageSystem),
            ]),
            group('Security & resilience', [
                link('Vulnerabilities', '/vulnerabilities', canManageSystem),
                link('Rate Limits', '/system/rates', isAdmin),
                link('Load Testing', '/load-testing', canManageSystem),
            ]),
            group('Data management', [
                link('Database', '/db', isAdmin),
                link('Backups', '/db/backups', isAdmin),
            ]),
        ]),
        group('Content', [
            link('Content Management', '/content', canManageContent),
            group('Writing', [
                link('Notes', '/notes', canManageContent),
                link('Articles', '/content/articles', canManageContent),
                link('Thoughts', '/content/thoughts', canManageContent),
            ]),
            link('Shares', '/shares'),
        ]),
        group('Administration', [
            group('Workspaces', [
                link('Projects', '/projects', isAdmin),
                link('Thesis', '/content/thesis', isAdmin),
            ]),
            group('Support', [
                link('Helpdesk', '/helpdesk', isAdmin),
                link('Mail', '/mail'),
            ]),
            group('Management', [
                link('Audit Log', '/management/audit', isAdmin),
                link('Users', '/management/users', isAdmin),
                link('Organizations', '/management/organizations', canManageOrganizations),
                link('Roles', '/management/roles', isAdmin),
                link('Service accounts', '/management/service-accounts', isAdmin),
            ]),
        ]),
        group('Settings', [
            group('Account & organization', [
                link('Profile', `/profile/${id}`),
                link('Organizations', '/organizations'),
            ]),
            group('Billing', [link('Subscription', '/subscription')]),
            group('Developer resources', [link('API Docs', '/api'), link('OpenAPI JSON', '/api/openapi')]),
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
