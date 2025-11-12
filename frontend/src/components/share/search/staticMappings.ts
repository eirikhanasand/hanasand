export const staticMappings = [
    {
        match: ['view site', 'site', 'view'],
        action: (query: string) => ({ action: 'site', text: 'View Site' })
    },
    {
        match: ['fetch', 'request', 'get', 'post', 'put', 'delete', 'head', 'options', 'patch', 'connect', 'trace'],
        action: (query: string) => ({ action: 'fetch', text: 'Fetch' })
    },
    {
        match: ['code', 'source'],
        action: () => ({ action: 'code', text: 'Code' })
    },
    {
        match: ['file'],
        action: (query: string) => ({ action: 'tree', text: 'Open file' })
    },
    {
        match: ['github'],
        action: (query: string) => ({ action: 'github', text: 'Open Github' })
    },
    {
        match: ['terminal', 'term', 'vm', 'ssh'],
        action: () => ({ action: 'terminal', text: 'Open Terminal' })
    },
    {
        match: ['theme', 'dark', 'light', 'sun', 'moon'],
        action: () => ({ action: 'theme', text: 'Change Theme' })
    },
    {
        match: ['hide', 'remove', 'debloat', 'close', 'nuke', 'tnt', 'despawn'],
        action: () => ({ action: 'hide', text: 'Hide All Open Tabs' })
    }
]

export default staticMappings
