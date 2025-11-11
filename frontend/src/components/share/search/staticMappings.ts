export const staticMappings = [
    {
        match: ['view site', 'site', 'view'],
        action: (query: string) => ({ action: 'site', text: 'View Site' })
    },
    {
        match: ['fetch', 'request'],
        action: (query: string) => ({ action: 'request', text: query })
    },
    {
        match: ['code', 'source'],
        action: () => ({ action: 'code', text: 'Code' })
    },
    {
        match: ['file'],
        action: (query: string) => ({ action: 'tree', text: query })
    },
    {
        match: ['github'],
        action: (query: string) => ({ action: 'github', text: query })
    },
    {
        match: ['terminal', 'vm', 'ssh'],
        action: () => ({ action: 'terminal', text: 'Open Terminal' })
    }
]

export default staticMappings
