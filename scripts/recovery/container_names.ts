/** Stable container names, independent of deployment port numbers. */
const PORTS = {
    api: [20802, 20803, 8082, 8083],
    frontend: [3200, 3300, 3000, 3100],
    auth: [8183, 8184, 8181, 8182],
}

export function pairName(kind, port) {
    return `hanasand-${kind}-${PORTS[kind].indexOf(Number(port)) + 1}`
}

export function simpleName(name) {
    if (!name.startsWith('hanasand-recovery-')) return name
    for (const [kind, ports] of Object.entries(PORTS)) {
        for (const port of ports) if (name === `hanasand-recovery-${kind}-${port}`) return pairName(kind, port)
    }
    const suffix = name.slice('hanasand-recovery-'.length)
    const fixed = { 'db-local': 'db-standby', monitor: 'health-monitor', 'proxy-0': 'proxy-1', 'proxy-1': 'proxy-2' }
    if (fixed[suffix]) return `hanasand-${fixed[suffix]}`
    if (['api', 'auth', 'frontend', 'db', 'ti', 'ti-local', 'tunnel', 'tunnel-monitor', 'tunnel-web', 'tunnel-intelligence', 'tunnel-database'].includes(suffix)) return `hanasand-${suffix}`
    return name
}

if (process.env.HANASAND_TYPESCRIPT_ENTRYPOINT?.endsWith('/container_names.ts') || process.argv[1]?.endsWith('/container_names.ts')) {
    console.log(pairName(...process.argv.slice(2)))
}
