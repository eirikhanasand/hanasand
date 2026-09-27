#!/usr/bin/env node
/** Emit site-local endpoints; ports are private, carried over restricted SSH. */
import { mkdir, open } from 'node:fs/promises'
import path from 'node:path'

const [site, root] = process.argv.slice(2)
if (!site || !root) throw new Error('Usage: configure.ts SITE ROOT')
const services = []
function service(id, name, port, check, ports) {
    const instances = ports.map(([instance, remoteSite, endpointPort]) => {
        const endpoint = `${remoteSite}:${endpointPort}`
        const instanceCheck = id === 'frontend' ? '/api/resilience/ready' : check
        const health = id === 'database' ? `postgres://127.0.0.1:${endpointPort}` : `http://127.0.0.1:${endpointPort}${instanceCheck}`
        const entry = { id: instance, site: remoteSite, endpoint, health: site === 'ovhcloud' && remoteSite === 'inspur' && id !== 'database' ? `peer:${instance}` : health }
        if (id !== 'database') entry.checkPath = instanceCheck
        if (site === 'inspur' || id === 'database' || remoteSite === 'ovhcloud') entry.address = `127.0.0.1:${endpointPort}`
        return entry
    })
    services.push({ id, name, listenPort: site === 'inspur' || id === 'database' ? port : null, checkPath: check, instances })
}
service('frontend', 'Frontend', 13000, '/', [['inspur-frontend-1', 'inspur', 3000], ['inspur-frontend-2', 'inspur', 3100], ['ovh-frontend', 'ovhcloud', 19300]])
service('api', 'API', 18080, '/health', [['inspur-api-1', 'inspur', 8082], ['inspur-api-2', 'inspur', 8083], ['ovh-api', 'ovhcloud', 19080]])
service('auth', 'Authentication', 18090, '/ready', [['inspur-auth-1', 'inspur', 8183], ['inspur-auth-2', 'inspur', 8184], ['ovh-auth', 'ovhcloud', 19090]])
service('intelligence', 'Threat intelligence queries', 18097, '/v1/health', [['inspur-ti-1', 'inspur', 8097], ['inspur-ti-2', 'inspur', 18099], ['ovh-ti', 'ovhcloud', 19097]])
service('database', 'Database', 18504, '', [['inspur-db-primary', 'inspur', site === 'inspur' ? 8503 : 18503], ['inspur-db-standby', 'inspur', 18502], ['ovh-db', 'ovhcloud', 18506]])
const config = { site, services, interval: 5, statsUrl: 'http://127.0.0.1:19900/stats;csv',
    peerStatusUrl: site === 'ovhcloud' ? 'http://127.0.0.1:19911/status' : null,
    databaseContainer: site === 'inspur' ? 'hanasand-db-standby' : 'hanasand-db', databasePort: site === 'inspur' ? 18502 : 18506,
    memoryBudgetMb: site === 'ovhcloud' ? 12288 : 16384 }
await mkdir(root, { recursive: true })
const file = await open(path.join(root, 'config.json'), 'wx')
try { await file.writeFile(JSON.stringify(config, null, 2)) }
finally { await file.close() }
