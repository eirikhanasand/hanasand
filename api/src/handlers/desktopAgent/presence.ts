import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

type PresenceBody = {
    deviceId?: string
    deviceName?: string
    endpoints?: string[]
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function isPrivateNetworkHost(hostname: string) {
    const host = hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return true
    if (host.startsWith('10.') || host.startsWith('192.168.')) return true
    const match = host.match(/^172\.(\d{1,2})\./)
    return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31)
}

function cleanEndpoints(value: unknown) {
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    const endpoints: string[] = []

    for (const entry of value) {
        const endpoint = clean(entry)
        if (!endpoint || seen.has(endpoint)) continue
        try {
            const url = new URL(endpoint)
            if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname || !url.port) continue
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') continue
            if (url.protocol === 'http:' && !isPrivateNetworkHost(url.hostname)) continue
            seen.add(url.origin)
            endpoints.push(url.origin)
        } catch {
            continue
        }
    }

    return endpoints.slice(0, 8)
}

function presenceRow(row: Record<string, unknown>) {
    const endpoints = Array.isArray(row.endpoints) ? row.endpoints.filter((item): item is string => typeof item === 'string') : []
    return {
        deviceId: row.device_id,
        deviceName: row.device_name,
        endpoints,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
    }
}

export async function getDesktopAgentPresence(req: FastifyRequest, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const result = await run(
            `SELECT device_id, device_name, endpoints, updated_at, expires_at
             FROM desktop_agent_presence
             WHERE owner_id = $1 AND expires_at > NOW()
             ORDER BY updated_at DESC
             LIMIT 3`,
            [id]
        )

        return res.send({ agents: result.rows.map(presenceRow) })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to load desktop agent presence.' })
    }
}

export async function postDesktopAgentPresence(req: FastifyRequest<{ Body: PresenceBody }>, res: FastifyReply) {
    const { valid, id } = await tokenWrapper(req, res)
    if (!valid || !id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const deviceId = clean(req.body?.deviceId)
    const deviceName = clean(req.body?.deviceName) || 'Mac'
    const endpoints = cleanEndpoints(req.body?.endpoints)

    if (!deviceId || !endpoints.length) {
        return res.status(400).send({ error: 'Desktop agent presence needs a device id and at least one LAN endpoint.' })
    }

    try {
        const result = await run(
            `INSERT INTO desktop_agent_presence (owner_id, device_id, device_name, endpoints, agent_token, expires_at)
             VALUES ($1, $2, $3, $4, '', NOW() + INTERVAL '5 minutes')
             ON CONFLICT (owner_id, device_id)
             DO UPDATE SET
                device_name = EXCLUDED.device_name,
                endpoints = EXCLUDED.endpoints,
                agent_token = '',
                updated_at = NOW(),
                expires_at = EXCLUDED.expires_at
             RETURNING device_id, device_name, endpoints, updated_at, expires_at`,
            [id, deviceId, deviceName.slice(0, 120), endpoints]
        )

        return res.send({ agent: presenceRow(result.rows[0]) })
    } catch (error) {
        req.log.error(error)
        return res.status(500).send({ error: 'Failed to publish desktop agent presence.' })
    }
}
