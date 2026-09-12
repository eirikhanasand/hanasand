// Only these read endpoints can replace an administrative role check. The API-key
// boundary still requires an exact method/route scope on every request.
export const serviceAccountEndpoints = [
    { method: 'GET', route: '/api/service-accounts/self', label: 'Check authentication', role: '' },
    { method: 'GET', route: '/api/logs', label: 'Read logs', role: 'system_admin' },
    { method: 'GET', route: '/api/logs/services', label: 'List log services', role: 'system_admin' },
    { method: 'GET', route: '/api/logs/errors', label: 'Read errors', role: 'system_admin' },
    { method: 'GET', route: '/api/metrics', label: 'Read host metrics', role: 'system_admin' },
    { method: 'GET', route: '/api/db', label: 'Read database overview', role: 'system_admin' },
    { method: 'GET', route: '/api/db/health', label: 'Read database health', role: 'system_admin' },
]

export function validateServiceAccountScopes(value: unknown): value is { method: string, route: string }[] {
    return Array.isArray(value) && value.length > 0 && value.length <= serviceAccountEndpoints.length
        && value.every(scope => scope && serviceAccountEndpoints.some(endpoint => endpoint.method === scope.method && endpoint.route === scope.route))
        && new Set(value.map(scope => `${scope.method} ${scope.route}`)).size === value.length
}
