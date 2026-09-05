// ponytail: keep page modules in place; native rewrites avoid a route-file migration.
export const appRoutes = [
    ['/dashboard/vulnerabilities', '/vulnerabilities'],
    ['/dashboard/ti/enrichment', '/ti/enrichment'],
    ['/dashboard/ti/evaluation', '/ti/evaluation'],
    ['/dashboard/ti/timeliness', '/ti/timeliness'],
    ['/dashboard/load-testing', '/load-testing'],
    ['/dashboard/subscription', '/subscription'],
    ['/dashboard/ti/workbench', '/ti/workbench'],
    ['/dashboard/ti/activity', '/ti/activity'],
    ['/dashboard/automation', '/automation'],
    ['/dashboard/management', '/management'],
    ['/dashboard/ti/attacks', '/ti/attacks'],
    ['/dashboard/ti/control', '/ti/control'],
    ['/dashboard/ti/domains', '/ti/domains'],
    ['/dashboard/ti/sources', '/ti/sources'],
    ['/dashboard/api-docs', '/api-docs'],
    ['/dashboard/articles', '/content/articles'],
    ['/dashboard/helpdesk', '/helpdesk'],
    ['/dashboard/overview', '/dashboard'],
    ['/dashboard/projects', '/projects'],
    ['/dashboard/thoughts', '/content/thoughts'],
    ['/dashboard/ti/audit', '/ti/audit'],
    ['/dashboard/article', '/content/article'],
    ['/dashboard/content', '/content'],
    ['/dashboard/scanner', '/scanner'],
    ['/dashboard/thought', '/content/thought'],
    ['/dashboard/ti/runs', '/ti/runs'],
    ['/dashboard/traffic', '/traffic'],
    ['/dashboard/backup', '/backup'],
    ['/dashboard/shares', '/shares'],
    ['/dashboard/system', '/system'],
    ['/dashboard/thesis', '/content/thesis'],
    ['/dashboard/notes', '/notes'],
    ['/dashboard/logs', '/logs'],
    ['/dashboard/mail', '/mail'],
    ['/dashboard/mill', '/mill'],
    ['/dashboard/dwm', '/dwm'],
    ['/dashboard/vms', '/vms'],
    ['/dashboard/db', '/db'],
    ['/dashboard/ti', '/ti/admin'],
    ['/dashboard/vm', '/vm']
] as const

const matches = (path: string, base: string) => path === base || path.startsWith(`${base}/`)

export function canonicalAppPath(path: string) {
    const route = appRoutes.find(([legacy]) => matches(path, legacy))
    return route ? route[1] + path.slice(route[0].length) : path
}

export function appPagePath(path: string) {
    const route = [...appRoutes].sort((a, b) => b[1].length - a[1].length).find(([, canonical]) => canonical !== '/dashboard' && matches(path, canonical))
    return route ? route[0] + path.slice(route[1].length) : path
}

export function isInternalAppPath(path: string) {
    return matches(path, '/dashboard') || matches(path, '/organizations') || appPagePath(path) !== path
}

export function hasAppSidebar(path: string) {
    return isInternalAppPath(path) || matches(path, '/profile') || matches(path, '/ti') || path === '/api'
}
