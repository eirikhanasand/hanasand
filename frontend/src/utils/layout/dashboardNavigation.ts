export type NavigationItem = {
    label: string
    href?: string
    items?: NavigationItem[]
    visible?: boolean
}

export type NavigationAccess = {
    id: string
    isAdmin: boolean
    canManageSystem: boolean
    canManageContent: boolean
    canReviewIntel?: boolean
}

export function getDashboardNavigation({ id, isAdmin, canManageSystem, canManageContent, canReviewIntel = isAdmin }: NavigationAccess): NavigationItem[] {
    const link = (label: string, href: string, visible = true): NavigationItem => ({ label, href, visible })
    const group = (label: string, items: NavigationItem[]): NavigationItem => ({ label, items })
    const sections = [
        group('Security operations', [
            link('Overview', '/dashboard'),
            link('Threat Search', '/ti'),
            group('Dark web monitoring', [
                group('Investigations', [
                    link('Cases', '/dwm/cases'),
                    link('Monitored actors', '/dwm/actors'),
                    link('Actions', '/dwm/actions'),
                ]),
                link('Watchlists', '/dwm/watchlists'),
                link('Integrations', '/dwm/delivery'),
            ]),
            group('Security tools', [
                link('Overview', '/mill'),
                link('Detection rules', '/mill/rules'),
                link('Scanner', '/scanner'),
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
                link('Audit Log', '/ti/audit', isAdmin),
            ]),
        ]),
        group('Automation', [
            group('Monitoring', [
                link('Health Checks', '/automation/health'),
                link('Execution Monitoring', '/automation/monitoring'),
            ]),
            group('Scheduling', [link('Cron Jobs', '/automation/cron')]),
        ]),
        group('Infrastructure', [
            link('Overview', '/system', canManageSystem),
            group('Compute', [
                link('Virtual Machines', '/vms', canManageSystem),
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
            link('Shares', '/shares', isAdmin),
        ]),
        group('Administration', [
            group('Workspaces', [
                link('Projects', '/projects', isAdmin),
                link('Thesis', '/content/thesis', isAdmin),
            ]),
            group('Support', [
                link('Helpdesk', '/helpdesk', isAdmin),
                link('Mail', '/mail', isAdmin),
            ]),
            link('Management', '/management', isAdmin),
        ]),
        group('Settings', [
            group('Account & organization', [
                link('Profile', `/profile/${id}`),
                link('Organizations', '/organizations'),
            ]),
            group('Billing', [link('Subscription', '/subscription')]),
            group('Developer resources', [link('API Docs', '/api')]),
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
