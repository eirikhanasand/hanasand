// The API-key boundary still requires an exact method/route scope for every request.
export const serviceAccountEndpoints = [
    { method: 'GET', route: '/api/service-accounts/self', label: 'Check authentication' },
    { method: 'GET', route: '/api/logs', label: 'Read logs' },
    { method: 'GET', route: '/api/logs/services', label: 'List log services' },
    { method: 'GET', route: '/api/logs/errors', label: 'Read errors' },
    { method: 'GET', route: '/api/metrics', label: 'Read host metrics' },
    { method: 'GET', route: '/api/db', label: 'Read database overview' },
    { method: 'GET', route: '/api/db/health', label: 'Read database health' },
    { method: 'GET', route: '/api/support/tickets', label: 'Read website support queue' },
    { method: 'GET', route: '/api/support/tickets/:id/messages', label: 'Read website support messages' },
    { method: 'POST', route: '/api/support/tickets/:id/messages', label: 'Reply to website support chats' },
    { method: 'GET', route: '/api/ws/support', label: 'Receive live support updates' },
]

export function validateServiceAccountScopes(value: unknown): value is { method: string, route: string }[] {
    return Array.isArray(value) && value.length > 0 && value.length <= serviceAccountEndpoints.length
        && value.every(scope => scope && serviceAccountEndpoints.some(endpoint => endpoint.method === scope.method && endpoint.route === scope.route))
        && new Set(value.map(scope => `${scope.method} ${scope.route}`)).size === value.length
}
