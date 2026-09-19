export const organizationPages = [
    { id: 'overview', label: 'Overview', href: '/organizations' },
    { id: 'settings', label: 'Settings', href: '/organizations/settings' },
    { id: 'team', label: 'Team', href: '/organizations/team' },
    { id: 'watchlists', label: 'Watchlists', href: '/organizations/watchlists' },
    { id: 'destinations', label: 'Destinations', href: '/organizations/destinations' },
    { id: 'api-keys', label: 'API keys', href: '/organizations/api-keys' },
    { id: 'privacy', label: 'Privacy & retention', href: '/organizations/privacy' },
    { id: 'delivery', label: 'Delivery history', href: '/organizations/delivery' },
    { id: 'alerts', label: 'Alerts & cases', href: '/organizations/alerts' },
    { id: 'activity', label: 'Activity', href: '/organizations/activity' },
] as const
export type OrganizationPage = typeof organizationPages[number]['id']
export function organizationPageForFocus(focus: string): OrganizationPage {
    if (/^(members?|invites?|team)$/.test(focus)) return 'team'
    if (focus.startsWith('watchlist')) return 'watchlists'
    if (focus.startsWith('destination')) return 'destinations'
    if (focus.startsWith('delivery')) return 'delivery'
    if (/^(alerts?|cases?|scope)$/.test(focus)) return 'alerts'
    if (focus === 'audit') return 'activity'
    return organizationPages.find(page => page.id === focus)?.id || 'overview'
}
