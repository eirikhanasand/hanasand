import type { DwmAlert } from './product'

type AlertDisplayInput = Pick<DwmAlert, 'actor' | 'artifactType' | 'claimSummary' | 'company' | 'matchedTerm' | 'sourceFamily'>

type FlatFields = Record<string, string>

export function safeAlertSummary(alert: AlertDisplayInput) {
    return formatClaimSummary(alert.claimSummary, alert)
}

export function formatClaimSummary(value: string, alert: Omit<AlertDisplayInput, 'claimSummary'>) {
    const clean = redactDisplayText(value || '').replace(/\s+/g, ' ').trim()
    const jsonLike = looksJsonLike(clean)
    const fields = jsonLike ? collectJsonFields(clean) : {}

    if (jsonLike) return buildClaimSentence(alert, fields)

    const plain = clean
        .replace(/[{}[\]"]/g, ' ')
        .replace(/\s*,\s*/g, ' · ')
        .replace(/\s*:\s*/g, ': ')
        .replace(/\s+/g, ' ')
        .trim()

    return truncateDisplayText(plain || buildClaimSentence(alert, fields))
}

export function safeEvidenceExcerpt(value: string) {
    const clean = redactDisplayText(value || '').replace(/\s+/g, ' ').trim()
    if (!clean) return 'Evidence metadata is available.'

    if (looksJsonLike(clean)) {
        const fields = collectJsonFields(clean)
        const summary = [
            pickField(fields, ['actorName', 'actor', 'sourceName', 'source']),
            pickField(fields, ['victimName', 'company', 'domain', 'matchedTerm', 'term']),
            pickField(fields, ['category', 'status', 'claimType', 'artifactType', 'state']),
            pickField(fields, ['observedAt', 'claimDate', 'date', 'lastSeenAt']),
        ].filter(Boolean).join(' · ')
        return truncateDisplayText(summary || 'Evidence metadata is available.')
    }

    return truncateDisplayText(clean.replace(/[{}[\]"]/g, ' ').replace(/\s+/g, ' ').trim())
}

export function evidenceStrengthLabel(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'Not scored'
    const normalized = value > 1 ? value / 100 : value
    if (normalized >= 0.8) return 'Strong'
    if (normalized >= 0.6) return 'Moderate'
    if (normalized >= 0.4) return 'Limited'
    return 'Needs review'
}

function buildClaimSentence(alert: Omit<AlertDisplayInput, 'claimSummary'>, fields: FlatFields) {
    const actor = pickField(fields, ['actorName', 'actor', 'sourceName', 'source']) || alert.actor || stateLabel(alert.sourceFamily)
    const victim = pickField(fields, ['victimName', 'company', 'domain', 'organization', 'matchedTerm', 'term']) || alert.company || alert.matchedTerm.value
    const status = pickField(fields, ['category', 'status', 'claimType', 'artifactType', 'type', 'state']) || stateLabel(alert.artifactType)
    return truncateDisplayText(`${actor} matched ${victim} as ${stateLabel(status)}.`)
}

function collectJsonFields(value: string) {
    const parsed = parseDisplayJson(value)
    if (!parsed) return {}
    return flattenFields(parsed)
}

function parseDisplayJson(value: string): unknown {
    const candidates = [
        value,
        value.replace(/\\"/g, '"'),
        extractJsonCandidate(value),
        extractJsonCandidate(value.replace(/\\"/g, '"')),
    ].filter(Boolean) as string[]

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate)
            if (typeof parsed === 'string') {
                const nested = parseDisplayJson(parsed)
                if (nested) return nested
            }
            return parsed
        } catch {
            // Try the next normalized candidate.
        }
    }
    return undefined
}

function extractJsonCandidate(value: string) {
    const first = value.search(/[{[]/)
    if (first < 0) return ''
    const lastBrace = Math.max(value.lastIndexOf('}'), value.lastIndexOf(']'))
    return lastBrace > first ? value.slice(first, lastBrace + 1) : value.slice(first)
}

function flattenFields(value: unknown, prefix = '', fields: FlatFields = {}) {
    if (!value || typeof value !== 'object') return fields
    if (Array.isArray(value)) {
        value.slice(0, 3).forEach((item, index) => flattenFields(item, `${prefix}${index}.`, fields))
        return fields
    }
    Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
        const field = prefix ? `${prefix}${key}` : key
        if (raw && typeof raw === 'object') {
            flattenFields(raw, `${field}.`, fields)
            return
        }
        if (raw === null || raw === undefined) return
        const text = redactDisplayText(String(raw)).replace(/\s+/g, ' ').trim()
        if (text) fields[field] = text
    })
    return fields
}

function pickField(fields: FlatFields, names: string[]) {
    const entry = Object.entries(fields).find(([key, value]) => value && names.some(name => key.toLowerCase().endsWith(name.toLowerCase())))
    return entry?.[1]
}

function looksJsonLike(value: string) {
    return /[{[]/.test(value) && /\\?"?[a-zA-Z0-9_ -]+\\?"?\s*:/.test(value)
}

function redactDisplayText(value: string) {
    return value
        .replace(/https:\/\/(?:canary\.)?discord(?:app)?\.com\/api\/webhooks\/[^\s"'<>]+/gi, '[webhook redacted]')
        .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g, '[token redacted]')
        .replace(/\b(?:token|secret|webhookUrl|authorization|apiKey)\s*[:=]\s*["']?[^"',}\]\s]+/gi, '$1: [redacted]')
}

function stateLabel(value: string) {
    return value.replaceAll('_', ' ').replace(/\s+/g, ' ').trim()
}

function truncateDisplayText(value: string) {
    return value.length > 180 ? `${value.slice(0, 177).trim()}...` : value
}
