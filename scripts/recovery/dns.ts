#!/usr/bin/env node
/** Scoped DNS recovery. No wildcard, mail, or unrelated record changes. */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export async function api(config, pathname, payload, method) {
    const values = Object.fromEntries(readFileSync(config.credentialsFile, 'utf8').split(/\r?\n/)
        .filter(line => line.includes('=') && !line.trimStart().startsWith('#')).map(line => {
            const split = line.indexOf('=')
            return [line.slice(0, split).trim(), line.slice(split + 1).trim()]
        }))
    const token = Buffer.from(`${values.dns_domeneshop_client_token}:${values.dns_domeneshop_client_secret}`).toString('base64')
    const response = await fetch(`https://api.domeneshop.no/v0${pathname}`, {
        method: method || (payload === undefined ? 'GET' : 'PUT'),
        headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Hanasand-Recovery/1.0' },
        body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`DNS provider returned HTTP ${response.status}`)
    const body = await response.text()
    return body ? JSON.parse(body) : null
}

export function probe(host, ip, pathname) {
    try {
        execFileSync('curl', ['-fsS', '--max-time', '4', '--resolve', `${host}:443:${ip}`, '-o', '/dev/null', `https://${host}${pathname}`],
            { stdio: 'ignore', timeout: 5000 })
        return true
    } catch { return false }
}

export async function reconcile(config, state, previous, now = Date.now() / 1000, dependencies = {}) {
    if (!config || !config.enabled) return [{ status: 'disabled', reason: 'Standby public endpoints must pass validation before DNS recovery is enabled.' }, []]
    const probeAddress = dependencies.probe || probe
    const callApi = dependencies.api || api
    const result = {}
    const events = []
    for (const record of config.records) {
        if (!['@', 'api', 'www'].includes(record.host) || record.type !== 'A') throw new Error('DNS recovery record outside allowed scope')
        const host = record.host === '@' ? 'hanasand.com' : `${record.host}.hanasand.com`
        const old = previous[host] || {}
        const primaryReady = probeAddress(host, config.primaryIp, record.checkPath)
        const standbyReady = probeAddress(host, config.standbyIp, record.checkPath)
        const target = primaryReady ? 'inspur' : standbyReady ? 'ovhcloud' : null
        const candidateSince = target === old.candidate ? old.candidateSince ?? now : now
        const current = { ...old, candidate: target, candidateSince, primaryReady, standbyReady }
        const delaySeconds = target === 'inspur' ? 120 : 60
        if (target && now - candidateSince >= delaySeconds && now - (old.verifiedAt || 0) >= 30) {
            const pathname = `/domains/${config.domainId}/dns/${record.id}`
            const existing = await callApi(config, pathname)
            if (existing.host !== record.host || existing.type !== 'A') throw new Error('DNS record identity changed')
            if (![config.primaryIp, config.standbyIp].includes(existing.data)) throw new Error('DNS record was changed by another operator')
            const desired = target === 'inspur' ? config.primaryIp : config.standbyIp
            if (existing.data !== desired) {
                await callApi(config, pathname, { host: record.host, type: 'A', ttl: 60, data: desired })
                const verified = await callApi(config, pathname)
                if (verified.data !== desired) throw new Error('DNS change not verified')
                events.push({ title: `${target === 'inspur' ? 'Failback' : 'Failover'}: ${host}`,
                    description: (target === 'inspur' ? 'Inspur is responding again, so traffic is moving back from OVH.' : 'Inspur is not responding, so traffic is moving to OVH.') + ' Some visitors may still reach the previous site until their DNS cache refreshes.',
                    color: target === 'inspur' ? 0x00cc66 : 0xff0000,
                    fields: [{ name: 'Still affected', value: state.affected?.join(', ') || 'All monitored services are back to normal.' }] })
            }
            Object.assign(current, { activeSite: target, verifiedAt: now, ttl: 60 })
        }
        result[host] = current
    }
    return [result, events]
}
