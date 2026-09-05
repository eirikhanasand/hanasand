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
            link('Overview', '/dashboard/overview'),
            link('Threat Search', '/ti'),
            group('Dark web monitoring', [
                group('Investigations', [
                    link('Cases', '/dashboard/dwm/cases'),
                    link('Monitored actors', '/dashboard/dwm/actors'),
                    link('Actions', '/dashboard/dwm/actions'),
                ]),
                link('Watchlists', '/dashboard/dwm/watchlists'),
                link('Integrations', '/dashboard/dwm/delivery'),
            ]),
            group('Security tools', [
                link('Overview', '/dashboard/mill'),
                link('Detection rules', '/dashboard/mill/rules'),
                link('Scanner', '/dashboard/scanner'),
            ]),
        ]),
        group('Threat intelligence', [
            group('Intelligence', [
                link('Latest Activity', '/dashboard/ti/activity', isAdmin),
                link('Attacks', '/dashboard/ti/attacks', isAdmin),
                link('Actor Profiles', '/dashboard/ti/enrichment', isAdmin),
            ]),
            group('Collection', [
                link('Overview', '/dashboard/ti/control', isAdmin),
                link('Sources', '/dashboard/ti/sources', isAdmin),
                link('Watched Entities', '/dashboard/ti/domains', isAdmin),
                link('Collection Runs', '/dashboard/ti/runs', isAdmin),
            ]),
            group('Quality & oversight', [
                link('Evaluation', '/dashboard/ti/evaluation', canReviewIntel),
                link('Timeliness', '/dashboard/ti/timeliness', canReviewIntel),
                link('Audit Log', '/dashboard/ti/audit', isAdmin),
            ]),
        ]),
        group('Automation', [
            group('Monitoring', [
                link('Health Checks', '/dashboard/automation/health'),
                link('Execution Monitoring', '/dashboard/automation/monitoring'),
            ]),
            group('Scheduling', [link('Cron Jobs', '/dashboard/automation/cron')]),
        ]),
        group('Infrastructure', [
            link('Overview', '/dashboard/system', canManageSystem),
            group('Compute', [
                link('Virtual Machines', '/dashboard/vms', canManageSystem),
                link('Host Updates', '/dashboard/system/updates', isAdmin),
            ]),
            group('Observability', [
                link('Traffic', '/dashboard/traffic', canManageSystem),
                link('Logs', '/dashboard/logs', isAdmin),
                link('AI Metrics', '/dashboard/system/ai', canManageSystem),
            ]),
            group('Security & resilience', [
                link('Vulnerabilities', '/dashboard/vulnerabilities', canManageSystem),
                link('Rate Limits', '/dashboard/system/rates', isAdmin),
                link('Load Testing', '/dashboard/load-testing', canManageSystem),
            ]),
            group('Data management', [
                link('Database', '/dashboard/db', isAdmin),
                link('Backups', '/dashboard/db/backups', isAdmin),
            ]),
        ]),
        group('Content', [
            link('Content Management', '/dashboard/content', canManageContent),
            group('Writing', [
                link('Notes', '/dashboard/notes', canManageContent),
                link('Articles', '/dashboard/articles', canManageContent),
                link('Thoughts', '/dashboard/thoughts', canManageContent),
            ]),
            link('Shares', '/dashboard/shares', isAdmin),
        ]),
        group('Administration', [
            group('Workspaces', [
                link('Projects', '/dashboard/projects', isAdmin),
                link('Thesis', '/dashboard/thesis', isAdmin),
            ]),
            group('Support', [
                link('Helpdesk', '/dashboard/helpdesk', isAdmin),
                link('Mail', '/dashboard/mail', isAdmin),
            ]),
            link('Management', '/dashboard/management', isAdmin),
        ]),
        group('Settings', [
            group('Account & organization', [
                link('Profile', `/profile/${id}`),
                link('Organizations', '/organizations'),
            ]),
            group('Billing', [link('Subscription', '/dashboard/subscription')]),
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
