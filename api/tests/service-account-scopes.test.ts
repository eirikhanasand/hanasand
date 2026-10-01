import { describe, expect, mock, test } from 'bun:test'
mock.module('#db', () => ({ default: async () => { throw new Error('Service accounts must not require a human session') } }))
const { hasHanasandInternalRouteAccess } = await import('../src/utils/auth/organizationPageAccess.ts')
const { matchApiKeyScope } = await import('../src/utils/auth/apiKeys.ts')
const { serviceAccountEndpoints, validateServiceAccountScopes } = await import('../src/utils/auth/serviceAccountScopes.ts')
const scopes = [{ method: 'GET', route: '/api/logs', enabled: true, limits: {}, id: 'scope' }]
const request = (method = 'GET', route = '/api/logs') => ({ method, url: route, routeOptions: { url: route }, headers: { id: 'administrator' }, apiKeyAuth: { serviceAccount: true, ownerId: 'svc_test', apiKey: { scopes } } })
describe('service account permissions', () => {
    test('scopes require a supported exact method and endpoint', () => {
        expect(validateServiceAccountScopes(scopes)).toBe(true)
        for (const invalid of [[], [{ method: 'GET', route: '/api/*' }], [{ method: 'POST', route: '/api/logs' }], [{ method: 'GET', route: '/api/users' }], [scopes[0], scopes[0]], null]) expect(validateServiceAccountScopes(invalid)).toBe(false)
    })
    test('Discord support actions have narrow service-account scopes', () => {
        expect(serviceAccountEndpoints).toContainEqual({ method: 'GET', route: '/api/support/discord/tickets', label: 'Read linked Discord support history' })
        expect(serviceAccountEndpoints).toContainEqual({ method: 'POST', route: '/api/support/discord/action', label: 'Manage linked Discord support chats' })
        expect(validateServiceAccountScopes([
            { method: 'GET', route: '/api/support/discord/tickets' },
            { method: 'POST', route: '/api/support/discord/action' },
        ])).toBe(true)
    })
    test('a selected endpoint grants only its specific method and route', async () => {
        expect((await hasHanasandInternalRouteAccess(request() as any)).valid).toBe(true)
        expect((await hasHanasandInternalRouteAccess(request('DELETE') as any)).valid).toBe(false)
        expect((await hasHanasandInternalRouteAccess(request('GET', '/api/metrics') as any)).valid).toBe(false)
    })
    test('disabled scopes and different methods do not match', () => {
        expect(matchApiKeyScope(scopes as any, 'POST', '/api/logs')).toBeNull()
        expect(matchApiKeyScope([{ ...scopes[0], enabled: false }] as any, 'GET', '/api/logs')).toBeNull()
    })
})
