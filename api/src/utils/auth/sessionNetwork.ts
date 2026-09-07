import { open, type CityResponse, type AsnResponse } from 'maxmind'
import { isPublicMonitoringAddress } from '../publicMonitoringRequest.ts'
import ipaddr from 'ipaddr.js'
import { join } from 'node:path'

const directory = process.env.SESSION_GEOIP_DIR || join(import.meta.dir, '../../../geoip')
let databases: Promise<Awaited<ReturnType<typeof loadDatabases>> | null> | undefined
let retryAt = 0
async function loadDatabases() {
    return Promise.all([
        open<CityResponse>(join(directory, 'city.mmdb')),
        open<AsnResponse>(join(directory, 'asn.mmdb')),
    ])
}

export async function sessionNetwork(value: string) {
    let ip = ''
    try { ip = ipaddr.process(value).toString() } catch { /* Legacy records may not contain an IP. */ }
    if (!isPublicMonitoringAddress(ip)) return { ip: null, network: null }
    if (!databases && Date.now() >= retryAt) {
        databases = loadDatabases().catch(error => {
            databases = undefined
            retryAt = Date.now() + 60_000
            console.warn('Session location databases unavailable:', error.message)
            return null
        })
    }
    const readers = await databases
    if (!readers) return { ip, network: null }
    const city = readers[0].get(ip)
    const asn = readers[1].get(ip)
    return {
        ip,
        network: {
            provider: asn?.autonomous_system_organization || null,
            country: city?.country?.names?.en || null,
            country_code: city?.country?.iso_code || null,
            region: city?.subdivisions?.[0]?.names?.en || null,
            city: city?.city?.names?.en || null,
        },
    }
}
