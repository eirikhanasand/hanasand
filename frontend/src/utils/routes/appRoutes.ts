import routes from './appRoutes.json'

export const appRoutes = routes as [string, string][]

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
