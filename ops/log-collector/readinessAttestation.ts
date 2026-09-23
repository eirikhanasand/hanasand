import { readFile, lstat } from 'node:fs/promises'
import { createPrivateKey, sign } from 'node:crypto'
import type { LogEvent } from './core'
import { matchesReadinessFact, readinessCanonical, readinessDigest, readinessRole } from '../../api/src/utils/mill/analyzeReadinessAudit'

const trustedContext = new WeakSet<object>()
export function markReadinessContext(event: LogEvent, attrs: Record<string, string>, rows: string[]) {
    if (attrs.success !== 'yes' || attrs.exit !== '0' || attrs.auid !== '4294967295'
        || attrs.ses !== '4294967295' || attrs.tty !== '(none)'
        || !['uid', 'euid', 'suid', 'fsuid', 'gid', 'egid', 'sgid', 'fsgid'].every(key => attrs[key] === '0')
        || rows.filter(row => row.startsWith('type=SYSCALL ')).length !== 1) return
    const exec = rows.filter(row => row.startsWith('type=EXECVE '))
    // This fixed short command never needs split argument records. Ambiguity stays visible.
    if (exec.length !== 1 || !/\bargc=5(?: |$)/.test(exec[0]!) || /\ba\d+\[/.test(exec[0]!)) return
    const indexes = [...exec[0]!.matchAll(/\ba(\d+)=/g)].map(match => match[1])
    if (JSON.stringify(indexes) !== JSON.stringify(['0', '1', '2', '3', '4'])) return
    const syscallKeys = [...rows.find(row => row.startsWith('type=SYSCALL '))!.matchAll(/\b(\w+)=/g)].map(match => match[1])
    if (new Set(syscallKeys).size !== syscallKeys.length) return
    trustedContext.add(event)
}

export function signReadinessEvent(event: LogEvent, fact: unknown, key: ReturnType<typeof createPrivateKey>): LogEvent | undefined {
    if (!trustedContext.has(event) || event.metadata?.readiness_execution || key.asymmetricKeyType !== 'ed25519'
        || !matchesReadinessFact(event, fact as any)) return
    const payload = { fact, eventDigest: readinessDigest(event) }
    return { ...event, metadata: { ...event.metadata, readiness_execution: { ...payload,
        signature: sign(null, Buffer.from(readinessCanonical(payload)), key).toString('base64') } as any } }
}

// A missing/malformed private key or native observation always preserves the original.
export async function* attestReadinessAudit(events: AsyncIterable<LogEvent>, root: string, host: string): AsyncGenerator<LogEvent> {
    const pending: LogEvent[] = []
    let overflow = false
    const candidate = (event: LogEvent) => {
        const args = (event.metadata?.process as any)?.arguments
        return host === 'inspur' && Array.isArray(args) && (args[0] === '/usr/lib/postgresql/15/bin/pg_isready' || args[0] === '/bin/sh' && args[3] === 'hanasand-readiness-v1')
    }
    try {
        for await (const event of events) {
            if (candidate(event) && pending.length < 1000) pending.push(event)
            else { if (candidate(event)) overflow = true; yield event }
        }
    } catch (error) {
        // Flush originals before surfacing source failure; never strand buffered evidence.
        for (const event of pending) yield event
        throw error
    }

    let key: ReturnType<typeof createPrivateKey> | undefined
    try {
        const path = `${root}/readiness-private.pem`, info = await lstat(path)
        if (info.isFile() && info.uid === 0 && !(info.mode & 0o077)) key = createPrivateKey(await readFile(path))
        if (key?.asymmetricKeyType !== 'ed25519') key = undefined
    } catch {}
    const counts = new Map<string, number>()
    const nonceOf = (event: LogEvent) => String((event.metadata?.process as any)?.arguments?.[4] || '').match(/^(?:dbname=hanasand application_name=pg_isready fallback_application_name=hanasand_probe_)?([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/)?.[1]
    for (const event of pending) { const nonce = nonceOf(event); if (nonce) { const key = nonce + ':' + readinessRole(event); counts.set(key, (counts.get(key) || 0) + 1) } }
    for (const event of pending) {
        try {
            const nonce = nonceOf(event)
            if (!overflow && trustedContext.has(event) && key && nonce && (counts.get(nonce + ':probe') || 0) <= 1 && (counts.get(nonce + ':wrapper') || 0) <= 1 && !event.metadata?.readiness_execution) {
                const directory = `${root}/readiness-facts`, dir = await lstat(directory), path = `${directory}/${nonce}.json`, info = await lstat(path)
                if (dir.isDirectory() && dir.uid === 0 && !(dir.mode & 0o077) && info.isFile() && info.uid === 0 && !(info.mode & 0o077) && info.size < 4096) {
                    const fact = JSON.parse(await readFile(path, 'utf8'))
                    const signed = signReadinessEvent(event, fact, key)
                    if (signed) { yield signed; continue }
                }
            }
        } catch {}
        yield event
    }
}
