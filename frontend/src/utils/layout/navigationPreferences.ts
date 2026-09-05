import { canonicalAppPath } from '@/utils/routes/appRoutes'

export type NavigationPreferences = { expanded: Record<string, boolean>, pinned: string[] }
export const NAVIGATION_COOKIE = 'dashboard_navigation'

export function readNavigationPreferences(raw: string | undefined, id: string): NavigationPreferences {
    try {
        const value = JSON.parse(decodeURIComponent(raw || ''))
        if (value.id !== id) return { expanded: {}, pinned: [] }
        return {
            expanded: Object.fromEntries(Object.entries(value.expanded || {}).filter((entry): entry is [string, boolean] => entry[0].length < 160 && typeof entry[1] === 'boolean')),
            pinned: Array.isArray(value.pinned) ? value.pinned.filter((path: unknown) => typeof path === 'string' && path.startsWith('/') && path.length < 160).map(canonicalAppPath) : [],
        }
    } catch { return { expanded: {}, pinned: [] } }
}
