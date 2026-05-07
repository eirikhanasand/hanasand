import type { FastifyRequest } from 'fastify'
import run from '#db'

type AgentPolicyAction =
    | 'ai_prompt'
    | 'generated_tool_call'
    | 'share_file_write'
    | 'http_request'
    | 'vm_http_request'
    | 'browser_task'

type AgentPolicyInput = {
    action: AgentPolicyAction
    actorId?: string | null
    approved?: boolean
    approvalId?: string | null
    target?: string | null
    method?: string | null
    path?: string | null
    content?: string | null
    prompt?: string | null
    context?: string | null
    metadata?: Record<string, unknown>
}

type AgentPolicyDecision = {
    status: 'allowed' | 'blocked' | 'checkpoint_required'
    risk: 'low' | 'medium' | 'high' | 'critical'
    reason: string
    hardBlock: boolean
    safeAlternative: string
    requiredApproval?: string
}

const SECRET_PATH_PATTERN = /(^|\/)(\.env$|\.env\.(?!example$)[^/]+|\.ssh($|\/)|id_rsa$|id_dsa$|id_ed25519$|authorized_keys$|known_hosts$|.*\.(pem|key|p12|pfx)$)/i
const SECRET_CONTENT_PATTERN = /(-----BEGIN (?:OPENSSH |RSA |EC |DSA |PRIVATE )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{24,})/i
const SECRET_EXFIL_PATTERN = /\b(print|show|dump|cat|read|exfiltrate|send|display|reveal)\b[\s\S]{0,80}\b(secret|secrets|token|tokens|password|passwords|api key|api keys|ssh key|private key|\.env|credentials)\b/i
const PRODUCTION_DB_PATTERN = /\b(production|prod|live)\b[\s\S]{0,80}\b(database|db|postgres|mysql|redis|backup|backups|customer data)\b/i
const BROAD_DELETE_PATTERN = /\b(rm\s+-rf|delete\s+(?:everything|all|the database|db|backups?|production|prod)|drop\s+(?:database|schema|table)|truncate\s+table|wipe|nuke|destroy)\b/i
const DESTRUCTIVE_METHODS = new Set(['DELETE', 'PATCH', 'PUT', 'POST'])

let ensuredAuditTable = false

export async function evaluateAgentActionPolicy(input: AgentPolicyInput): Promise<AgentPolicyDecision> {
    const haystack = [
        input.target,
        input.method,
        input.path,
        input.prompt,
        input.context,
        input.content,
        JSON.stringify(input.metadata || {}),
    ].filter(Boolean).join('\n')

    const path = input.path || input.target || ''
    const method = (input.method || '').toUpperCase()

    if (SECRET_PATH_PATTERN.test(path)) {
        return blocked('critical', 'The requested action targets an environment file, SSH key, or private key path.', 'Use a redacted .env.example placeholder or a scoped secret manager reference instead.')
    }

    if (SECRET_EXFIL_PATTERN.test(haystack) || SECRET_CONTENT_PATTERN.test(input.content || '')) {
        return blocked('critical', 'The requested action would expose or print secret material.', 'Return only variable names, placeholders, or rotation instructions. Never echo secret values.')
    }

    if (PRODUCTION_DB_PATTERN.test(haystack)) {
        return blocked('critical', 'The requested action appears to write to production data or backups.', 'Use a read-only inspection, staging database, or dry-run migration plan with restore proof.')
    }

    if (BROAD_DELETE_PATTERN.test(haystack)) {
        return blocked('critical', 'The requested action is a broad or irreversible delete.', 'Create a checkpoint, list exact targets, and provide a dry-run delete plan instead.')
    }

    if (input.action === 'http_request' || input.action === 'vm_http_request') {
        if (method === 'DELETE') {
            return blocked('critical', 'HTTP DELETE is blocked for agent tools because it can remove data remotely.', 'Use GET/HEAD to inspect state, or create a human-reviewed backend action with rollback evidence.')
        }

        if (DESTRUCTIVE_METHODS.has(method) && !input.approved) {
            return checkpoint('high', `HTTP ${method} can mutate remote state and needs explicit approval.`, 'Run a GET/HEAD dry-run or explain the exact endpoint, payload, rollback, and expected effect before retrying.')
        }
    }

    if (input.action === 'share_file_write') {
        if (!input.approved) {
            return checkpoint('medium', 'File writes require the user-facing pending-change checkpoint before execution.', 'Stage the change for review, show affected files, and let the user apply it explicitly.')
        }
    }

    return {
        status: 'allowed',
        risk: 'low',
        reason: 'Allowed by agent action policy.',
        hardBlock: false,
        safeAlternative: 'Proceed with the scoped action and record the audit entry.',
    }
}

export async function auditAgentAction(req: FastifyRequest, input: AgentPolicyInput, decision: AgentPolicyDecision, result: 'allowed' | 'blocked' | 'checkpoint_required' | 'completed' | 'failed' = decision.status) {
    try {
        await ensureAgentActionAuditTable()
        await run(`
            INSERT INTO ai_agent_action_audit (
                actor_id, authenticated_actor_id, action, target, risk, decision, approved,
                approval_id, hard_block, safe_alternative, reason, request_id, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        `, [
            input.actorId || null,
            typeof req.headers['x-authenticated-id'] === 'string' ? req.headers['x-authenticated-id'] : null,
            input.action,
            input.target || input.path || null,
            decision.risk,
            result,
            Boolean(input.approved),
            input.approvalId || null,
            decision.hardBlock,
            decision.safeAlternative,
            decision.reason,
            requestId(req),
            JSON.stringify(redactMetadata({
                ...input.metadata,
                method: input.method,
                path: input.path,
            })),
        ])
    } catch (error) {
        req.log.error({ err: error }, 'Unable to write agent action audit event.')
    }
}

export function redactAgentText(value: string) {
    return value
        .replace(/-----BEGIN (?:OPENSSH |RSA |EC |DSA |PRIVATE )?PRIVATE KEY-----[\s\S]*?-----END (?:OPENSSH |RSA |EC |DSA |PRIVATE )?PRIVATE KEY-----/g, '[redacted-private-key]')
        .replace(/\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/gi, (match) => `${match.split(/[:=]/)[0]}=[redacted]`)
        .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[redacted-github-token]')
        .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-aws-key]')
}

function blocked(risk: AgentPolicyDecision['risk'], reason: string, safeAlternative: string): AgentPolicyDecision {
    return {
        status: 'blocked',
        risk,
        reason,
        hardBlock: true,
        safeAlternative,
    }
}

function checkpoint(risk: AgentPolicyDecision['risk'], reason: string, safeAlternative: string): AgentPolicyDecision {
    return {
        status: 'checkpoint_required',
        risk,
        reason,
        hardBlock: false,
        safeAlternative,
        requiredApproval: 'explicit_user_checkpoint',
    }
}

async function ensureAgentActionAuditTable() {
    if (ensuredAuditTable) {
        return
    }

    await run(`
        CREATE TABLE IF NOT EXISTS ai_agent_action_audit (
            id BIGSERIAL PRIMARY KEY,
            actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            authenticated_actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            target TEXT,
            risk TEXT NOT NULL,
            decision TEXT NOT NULL,
            approved BOOLEAN NOT NULL DEFAULT false,
            approval_id TEXT,
            hard_block BOOLEAN NOT NULL DEFAULT false,
            safe_alternative TEXT NOT NULL,
            reason TEXT NOT NULL,
            request_id TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_ai_agent_action_audit_actor_created ON ai_agent_action_audit(actor_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_agent_action_audit_decision_created ON ai_agent_action_audit(decision, created_at DESC)')
    ensuredAuditTable = true
}

function requestId(req: FastifyRequest) {
    const header = req.headers['x-request-id']
    return Array.isArray(header) ? header[0] || null : header || null
}

function redactMetadata(metadata: Record<string, unknown>) {
    const redacted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(metadata)) {
        if (/secret|token|password|credential|key/i.test(key)) {
            redacted[key] = '[redacted]'
        } else if (typeof value === 'string') {
            redacted[key] = redactAgentText(value).slice(0, 1000)
        } else {
            redacted[key] = value
        }
    }
    return redacted
}
