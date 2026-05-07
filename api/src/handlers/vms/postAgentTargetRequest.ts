import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasRole from '#utils/auth/hasRole.ts'
import { agentTargetSelect } from '#utils/vms/agentTargetQuery.ts'
import config from '#constants'
import { auditAgentAction, evaluateAgentActionPolicy } from '#utils/ai/actionPolicy.ts'

type VMRow = {
    name: string
    owner: string
    created_by: string
    access_users: string[] | null
    device_eth0_ipv4_address: string
}

type RequestBody = {
    method?: string
    url?: string
    headers?: Record<string, unknown>
    body?: string
    approved?: boolean
    approvalId?: string
}

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export default async function postAgentTargetRequest(req: FastifyRequest, res: FastifyReply) {
    const { valid, id: userId } = await tokenWrapper(req, res)
    if (!valid || !userId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'Missing VM id.' })
    }

    const body = (req.body as RequestBody | undefined) ?? {}
    const method = String(body.method || 'GET').toUpperCase()
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const requestBody = typeof body.body === 'string' ? body.body : ''
    const headers = normalizeHeaders(body.headers)

    if (!url) {
        return res.status(400).send({ error: 'Missing url.' })
    }

    if (!ALLOWED_METHODS.has(method)) {
        return res.status(400).send({ error: 'Unsupported HTTP method.' })
    }

    let targetUrl: URL
    try {
        targetUrl = new URL(url)
    } catch {
        return res.status(400).send({ error: 'Invalid url.' })
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        return res.status(400).send({ error: 'Only http and https requests are supported.' })
    }

    const { valid: isAdmin } = await hasRole(req, res, 'system_admin')

    try {
        const result = await run(`
            ${agentTargetSelect}
            WHERE v.name = $1
            LIMIT 1
        `, [id])

        if (!result.rows.length) {
            return res.status(404).send({ error: 'VM not found.' })
        }

        const vm = result.rows[0] as VMRow
        const accessUsers = Array.isArray(vm.access_users) ? vm.access_users : []
        const canAccess =
            isAdmin
            || vm.owner === userId
            || vm.created_by === userId
            || accessUsers.includes(userId)

        if (!canAccess) {
            return res.status(403).send({ error: 'Forbidden.' })
        }

        const allowedHosts = getAllowedHosts(vm)
        if (!isAllowedVmRequestHost(targetUrl, allowedHosts)) {
            return res.status(400).send({
                error: 'VM request targets must stay on loopback or the VM IPv4 address.',
                allowedHosts,
            })
        }

        const approval = parseApproval(body)
        const policyDecision = await evaluateAgentActionPolicy({
            action: 'vm_http_request',
            actorId: userId,
            method,
            target: targetUrl.toString(),
            content: requestBody,
            approved: approval.approved,
            approvalId: approval.approvalId,
            metadata: { vmName: vm.name, allowedHosts },
        })
        await auditAgentAction(req, {
            action: 'vm_http_request',
            actorId: userId,
            method,
            target: targetUrl.toString(),
            content: requestBody,
            approved: approval.approved,
            approvalId: approval.approvalId,
            metadata: { vmName: vm.name, allowedHosts },
        }, policyDecision)
        if (policyDecision.status === 'blocked') {
            return res.status(403).send({ error: policyDecision.reason, decision: policyDecision })
        }
        if (policyDecision.status === 'checkpoint_required') {
            return res.status(409).send({ error: policyDecision.reason, decision: policyDecision })
        }

        const internalResponse = await fetch(`${config.internal_api}/vm/${encodeURIComponent(vm.name)}/request`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${encodeURIComponent(config.vm_api_token || '')}`,
                'Content-Type': 'application/json',
                'User-Agent': 'hanasand_api',
            },
            body: JSON.stringify({
                method,
                url: targetUrl.toString(),
                headers,
                body: requestBody,
            }),
        })

        const text = await internalResponse.text()
        const payload = parseObject(text)
        const responseBody = {
            vmName: vm.name,
            trustBoundary: 'vm_local_http',
            allowedHosts,
            ...payload,
        }

        if (!internalResponse.ok) {
            return res.status(internalResponse.status).send(responseBody)
        }

        return res.send(responseBody)
    } catch (error) {
        req.log.error({ err: error, vmId: id, userId }, 'Unable to proxy VM-local HTTP request.')
        return res.status(500).send({ error: 'Unable to run request through VM target.' })
    }
}

function parseApproval(body: RequestBody) {
    return {
        approved: body.approved === true,
        approvalId: typeof body.approvalId === 'string' ? body.approvalId : null,
    }
}

function normalizeHeaders(headers: RequestBody['headers']) {
    const entries = Object.entries(headers || {})
        .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && entry[0].trim().length > 0 && typeof entry[1] === 'string')
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value.length > 0)

    return Object.fromEntries(entries)
}

function getAllowedHosts(vm: VMRow) {
    return [...new Set([
        'localhost',
        '127.0.0.1',
        '::1',
        String(vm.device_eth0_ipv4_address || '').trim(),
    ].filter(Boolean))]
}

function isAllowedVmRequestHost(url: URL, allowedHosts: string[]) {
    const normalizedHost = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    return allowedHosts.some((host) => host.toLowerCase() === normalizedHost)
}

function parseObject(text: string) {
    if (!text) {
        return {}
    }

    try {
        const parsed = JSON.parse(text) as unknown
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : { raw: parsed }
    } catch {
        return { raw: text }
    }
}
