import { suggestionRoutes } from './publicRoutes'

export function suggestRoutes(path: string, routes = suggestionRoutes) {
    const needle = normalizePath(path)
    return routes
        .filter(route => route !== needle)
        .map(route => ({ route, distance: levenshtein(needle, route, 4) }))
        .filter(item => item.distance < 5)
        .sort((a, b) => a.distance - b.distance || a.route.localeCompare(b.route))
        .slice(0, 3)
        .map(item => item.route)
}

function normalizePath(path: string) {
    const [pathname = '/'] = path.split(/[?#]/)
    const clean = pathname.startsWith('/') ? pathname : `/${pathname}`
    return clean.length > 1 ? clean.replace(/\/+$/, '').toLowerCase() : clean
}

function levenshtein(a: string, b: string, maxDistance: number) {
    if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1

    let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const current = [i]
        let rowMin = current[0]
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + cost
            )
            rowMin = Math.min(rowMin, current[j])
        }
        if (rowMin > maxDistance) return maxDistance + 1
        previous = current
    }
    return previous[b.length]
}
