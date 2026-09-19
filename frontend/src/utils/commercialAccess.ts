export const commercialAccessPlans = [
    {
        id: 'threat-intelligence',
        name: 'Threat Intelligence',
        priceNok: 199,
        quota: '100 searches per day',
        summary: 'Search actors, domains, companies, and current public intelligence.',
        features: ['Threat actor profiles', 'Current intelligence results', 'API access', 'Saved searches'],
    },
    {
        id: 'monitoring',
        name: 'Dark Web Monitoring',
        priceNok: 499,
        quota: '25 watch terms',
        summary: 'Monitor relevant public intelligence and turn matches into alerts and cases.',
        features: ['Customer watchlists', 'Evidence-backed alerts', 'Case workflow', 'Source health and freshness'],
    },
    {
        id: 'scanner',
        name: 'Security Scanner',
        priceNok: 299,
        quota: '10 monitored targets',
        summary: 'Run scheduled security checks against approved websites and review the findings.',
        features: ['Scheduled scans', 'Severity-based findings', 'Scan history', 'Run-now controls'],
    },
    {
        id: 'browser',
        name: 'Browser',
        priceNok: 99,
        quota: '100 browser runs',
        summary: 'Inspect clearweb and darkweb sources through the controlled Browser product.',
        features: ['Clearweb browsing', 'Safe darkweb previews', 'Evidence capture', 'Run history'],
    },
] as const

export const containerAccessPlans = [
    { id: 'always_running', name: 'Always running', priceNok: 49, summary: 'Keep this container running, with automatic restarts and protection from idle shutdown.' },
    { id: 'failover', name: 'Failover', priceNok: 99, summary: 'Keep a copy on the other host and switch hosts with a verified container transfer.' },
] as const
