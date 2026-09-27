#!/usr/bin/env node
/** Maintenance for the two local routers; does not stop application containers. */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createConnection } from 'node:net'

const [root, service, mode, ...instances] = process.argv.slice(2)
if (!root || !service || !['maint', 'ready'].includes(mode) || !instances.length) throw new Error('Usage: maintenance.ts ROOT SERVICE maint|ready INSTANCE...')
const configPath = path.join(root, 'config.json')
const config = JSON.parse(await readFile(configPath, 'utf8'))
const allowed = new Set(config.services.filter(item => item.id === service).flatMap(item => item.instances.map(instance => instance.id)))
if (!instances.every(instance => allowed.has(instance))) throw new Error('Unknown service instance')
const maintained = new Set(config.maintenanceInstances || [])
for (const instance of instances) mode === 'maint' ? maintained.add(instance) : maintained.delete(instance)
config.maintenanceInstances = [...maintained].sort()
await writeFile(configPath, JSON.stringify(config, null, 2))

function updateRouter(port, instance) {
    return new Promise((resolve, reject) => {
        const connection = createConnection({ host: '127.0.0.1', port })
        let response = ''
        connection.setTimeout(3000, () => connection.destroy(new Error('HAProxy admin socket timed out')))
        connection.on('connect', () => connection.end(`set server ${service}/${instance} state ${mode}\n`))
        connection.on('data', chunk => { response += chunk.toString() })
        connection.on('error', reject)
        connection.on('end', () => response.trim() ? reject(new Error(response.trim())) : resolve())
    })
}
for (const port of [19909, 19910]) for (const instance of instances) await updateRouter(port, instance)
console.log(JSON.stringify({ service, instances, state: mode, routers: 2 }))
