export const staticMappings = [
    {
        match: ['view site', 'site', 'view', 'render', 'display', 'show'],
        action: () => ({ action: 'site', text: 'View Site' })
    },
    {
        match: ['fetch', 'request', 'get', 'post', 'put', 'delete', 'head', 'options', 'patch', 'connect', 'trace'],
        action: () => ({ action: 'fetch', text: 'Fetch' })
    },
    {
        match: ['code', 'source'],
        action: () => ({ action: 'code', text: 'Code' })
    },
    {
        match: ['file'],
        action: () => ({ action: 'tree', text: 'Open file' })
    },
    {
        match: ['github'],
        action: () => ({ action: 'github', text: 'Open Github' })
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
    },
    {
        match: ['info', 'meta', 'data'],
        action: () => ({ action: 'info', text: 'Show info' })
    },
    {
        match: ['file', 'explore', 'sidebar'],
        action: () => ({ action: 'explorer', text: 'Show files' })
    },
    {
        match: ['reload', 'refresh'],
        action: () => ({ action: 'reload', text: 'Reload' })
    }
]

export default staticMappings
