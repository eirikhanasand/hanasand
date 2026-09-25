const instanceNames: Record<string, string> = {
    'api-8082': 'api-3', 'api-20802': 'api-1',
    'api-8083': 'api-4', 'api-20803': 'api-2',
    'frontend-3000': 'frontend-3', 'frontend-3200': 'frontend-1',
    'frontend-3100': 'frontend-4', 'frontend-3300': 'frontend-2',
    'auth-8181': 'auth-3', 'auth-8183': 'auth-1',
    'auth-8182': 'auth-4', 'auth-8184': 'auth-2',
    'db-local': 'db-standby',
    'proxy-0': 'proxy-1', 'proxy-1': 'proxy-2',
    'monitor': 'health-monitor',
}

// Deployment ports change between releases; display stable instance names.
// Keep the original service identifier for log queries and filter URLs.
export function displayLogServiceName(service: string) {
    if (service === 'hanasand_api') return 'hanasand-api-worker'
    if (!service.startsWith('hanasand-recovery-')) return service
    const name = service.slice('hanasand-recovery-'.length)
    return `hanasand-${instanceNames[name] || name}`
}
