import { readFile, lstat } from 'node:fs/promises'
import { createPrivateKey, sign } from 'node:crypto'
import type { AtomicEventGroup, LogEvent } from './core'
import { matchesReadinessFact, readinessCanonical, readinessRole, readinessRoles, readinessChainPayload } from '../../api/src/utils/mill/analyzeReadinessAudit'

const trustedContext = new WeakSet<object>()
export function markReadinessContext(event: LogEvent, attrs: Record<string, string>, rows: string[]) {
    if (attrs.success !== 'yes' || attrs.exit !== '0' || attrs.auid !== '4294967295'
        || attrs.ses !== '4294967295' || attrs.tty !== '(none)'
        || !['uid', 'euid', 'suid', 'fsuid', 'gid', 'egid', 'sgid', 'fsgid'].every(key => attrs[key] === '0')
        || rows.filter(row => row.startsWith('type=SYSCALL ')).length !== 1) return
    const exec = rows.filter(row => row.startsWith('type=EXECVE '))
    // This fixed short command never needs split argument records. Ambiguity stays visible.
    const role = readinessRole(event), argc = role === 'root' ? 3 : role === 'entry' ? 6 : 5
    if (!role || exec.length !== 1 || !new RegExp('\\bargc=' + argc + '(?: |$)').test(exec[0]!) || /\ba\d+\[/.test(exec[0]!)) return
    const indexes = [...exec[0]!.matchAll(/\ba(\d+)=/g)].map(match => match[1])
    if (JSON.stringify(indexes) !== JSON.stringify(Array.from({ length: argc }, (_, index) => String(index)))) return
    const syscallKeys = [...rows.find(row => row.startsWith('type=SYSCALL '))!.matchAll(/\b(\w+)=/g)].map(match => match[1])
    if (new Set(syscallKeys).size !== syscallKeys.length) return
    trustedContext.add(event)
}

export function signReadinessChain(events: LogEvent[], fact: unknown, key: ReturnType<typeof createPrivateKey>): AtomicEventGroup | undefined {
    if (events.some(event => !trustedContext.has(event) || event.metadata?.readiness_execution) || key.asymmetricKeyType !== 'ed25519') return
    const payload = readinessChainPayload(events, fact as any)
    if (!payload) return
    const ordered = readinessRoles.map(role => events.find(event => readinessRole(event) === role)!)
    return { atomic: true, events: ordered.map((event, index) => index ? event : { ...event, metadata: { ...event.metadata, readiness_execution: { ...payload,
        signature: sign(null, Buffer.from(readinessCanonical(payload)), key).toString('base64') } as any } }) }
}

// A missing/malformed key, incomplete chain or native observation preserves originals.
export async function* attestReadinessAudit(events: AsyncIterable<LogEvent>, root: string, host: string): AsyncGenerator<LogEvent | AtomicEventGroup> {
    const pending: LogEvent[] = []
    let overflow = false
    try {
        for await (const event of events) {
            if (event.host === host && event.service === 'audit') {
                if (pending.length < 1000) pending.push(event)
                else { overflow = true; yield event }
            } else yield event
        }
    } catch (error) { for (const event of pending) yield event; throw error }
    let key: ReturnType<typeof createPrivateKey> | undefined
    try {
        const path = `${root}/readiness-private.pem`, info = await lstat(path)
        if (info.isFile() && info.uid === 0 && !(info.mode & 0o077)) key = createPrivateKey(await readFile(path))
        if (key?.asymmetricKeyType !== 'ed25519') key = undefined
    } catch {}
    if (overflow || !key) { for (const event of pending) yield event; return }
    const used = new Set<LogEvent>()
    for (const wrapper of pending.filter(event => readinessRole(event) === 'wrapper')) {
        try {
            const nonce = (wrapper.metadata.process as any)?.arguments?.[4]
            if (typeof nonce !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(nonce)) continue
            const directory = `${root}/readiness-facts`, dir = await lstat(directory), path = `${directory}/${nonce}.json`, info = await lstat(path)
            if (!dir.isDirectory() || dir.uid !== 0 || (dir.mode & 0o077) || !info.isFile() || info.uid !== 0 || (info.mode & 0o077) || info.size >= 4096) continue
            const fact = JSON.parse(await readFile(path, 'utf8'))
            const matches = pending.filter(event => matchesReadinessFact(event, fact))
            if (matches.some(event => used.has(event))) continue
            // Additional executions by the bound processes make the whole chain ambiguous.
            const related = pending.filter(event => {
                const process = event.metadata.process as any, time = Date.parse(event.timestamp)
                return time >= fact.startedAt && time <= fact.finishedAt && [process?.pid, process?.parent_pid].some(pid => [String(fact.execPid), String(fact.parentPid)].includes(pid))
            })
            if (related.some(event => !matches.includes(event))) continue
            const signed = signReadinessChain(matches, fact, key)
            if (!signed) continue
            for (const event of matches) used.add(event)
            // Transport must deliver the authenticated originals together, including retries.
            yield signed
        } catch {}
    }
    for (const event of pending) if (!used.has(event)) yield event
}
