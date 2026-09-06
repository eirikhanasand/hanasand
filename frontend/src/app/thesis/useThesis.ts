'use client'

import { useEffect, useRef, useState } from 'react'
import config from '@/config'
import type { ThesisDocument } from '@/utils/thesis'

type Recovery = ThesisDocument & { key: string, savedAt: number }
const prefix = 'hanasand-thesis-recovery:'
const same = (a: ThesisDocument, b: ThesisDocument) => a.title === b.title && a.body === b.body

export default function useThesis(initial: ThesisDocument, canEdit: boolean) {
    const [document, setDocument] = useState(initial)
    const [undoState, setUndoState] = useState({ undo: 0, redo: 0 })
    const [error, setError] = useState('')
    const [conflict, setConflict] = useState(false)
    const [recoveries, setRecoveries] = useState<Recovery[]>([])
    const actions = useRef<{
        update(field: 'title' | 'body', value: string, group?: string): void
        undo(): void
        redo(): void
        flush(): Promise<boolean>
        restore(document: ThesisDocument): Promise<boolean>
        recover(recovery: Recovery): void
        resolve(keepDraft: boolean): void
    } | null>(null)

    useEffect(() => {
        let draft = initial
        let base = initial
        let remote: ThesisDocument | null = null
        let sent: ThesisDocument | null = null
        let inFlight: Promise<boolean> | null = null
        let timer: ReturnType<typeof setTimeout> | undefined
        let reconnect: ReturnType<typeof setTimeout> | undefined
        let socket: WebSocket | undefined
        let stopped = false
        let retryDelay = 1000
        let key = ''
        let recovered: Recovery | null = null
        let past: ThesisDocument[] = []
        let future: ThesisDocument[] = []
        let lastGroup: string | undefined
        let lastEdit = 0
        const publishUndo = () => setUndoState({ undo: past.length, redo: future.length })
        function clearUndo() {
            past = []; future = []; lastGroup = undefined
            publishUndo()
        }
        function remember(group?: string) {
            const now = Date.now()
            // Group continuous typing; structural changes remain separate undo steps.
            if (!group || group !== lastGroup || now - lastEdit > 750 || future.length) past = [...past.slice(-49), draft]
            future = []
            lastGroup = group; lastEdit = now
            publishUndo()
        }
        function travel(redo: boolean) {
            if (!canEdit || remote) return
            const previous = (redo ? future : past).pop()
            if (!previous) return
            if (redo) past.push(draft)
            else future.push(draft)
            lastGroup = undefined
            draft = { ...previous, revision: base.revision }
            setDocument(draft)
            publishUndo()
            keepDraft()
            schedule()
        }
        const dirty = () => !same(draft, base)

        function keepDraft() {
            if (!key || !canEdit) return
            try {
                if (dirty()) localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }))
                else localStorage.removeItem(key)
            } catch {
                setError('Browser recovery storage is unavailable. Keep this page open until your changes reach the server.')
            }
        }

        function schedule() {
            if (!canEdit || stopped || remote || timer || !dirty()) return
            timer = setTimeout(() => { timer = undefined; void flush() }, 5000)
        }

        function receive(next: ThesisDocument) {
            if (!Number.isSafeInteger(next.revision) || typeof next.title !== 'string' || typeof next.body !== 'string' || next.revision < base.revision) return
            if (next.revision === base.revision) return
            if (dirty() && !same(draft, next) && !(sent && same(sent, next))) {
                remote = next
                setConflict(true)
                setError('Another tab changed the thesis. Your draft is kept in this browser.')
                return
            }
            const preserveDraft = !same(draft, next) && (dirty() || Boolean(sent && same(sent, next)))
            if (!preserveDraft && !same(draft, next)) clearUndo()
            remote = null
            setConflict(false)
            setError('')
            base = next
            draft = preserveDraft ? { ...draft, revision: next.revision } : next
            setDocument(draft)
            keepDraft()
            schedule()
        }

        async function flush(): Promise<boolean> {
            if (!canEdit || stopped || remote) return false
            if (inFlight) {
                if (!await inFlight) return false
                return flush()
            }
            if (!dirty()) return true
            const snapshot = { ...draft, revision: base.revision }
            sent = snapshot
            inFlight = (async() => {
                try {
                    const response = await fetch('/api/thesis', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(snapshot),
                        keepalive: new Blob([JSON.stringify(snapshot)]).size <= 60000,
                        signal: AbortSignal.timeout(15000),
                    })
                    const next = await response.json()
                    if (stopped) return false
                    if (response.status === 409) {
                        remote = next
                        setConflict(true)
                        setError('Another tab changed the thesis. Your draft is kept in this browser.')
                        return false
                    }
                    if (!response.ok) throw new Error(next.error || 'Autosave failed. Your draft is kept in this browser.')
                    receive(next)
                    if (same(draft, next)) {
                        base = next
                        draft = next
                        keepDraft()
                    }
                    if (recovered) {
                        const previous = localStorage.getItem(recovered.key)
                        if (previous && same(JSON.parse(previous), recovered)) localStorage.removeItem(recovered.key)
                        const recoveredKey = recovered.key
                        recovered = null
                        setRecoveries(items => items.filter(item => item.key !== recoveredKey))
                    }
                    setError('')
                    return true
                } catch (failure) {
                    if (!stopped) setError(failure instanceof Error ? failure.message : 'Autosave failed. Your draft is kept in this browser.')
                    return false
                } finally {
                    sent = null
                    inFlight = null
                    schedule()
                }
            })()
            return inFlight
        }

        function closeFlush() {
            if (!canEdit || remote || !dirty()) return
            keepDraft()
            const body = JSON.stringify({ ...draft, revision: base.revision })
            // Browsers cap keepalive/beacon payloads at about 64 KiB. Larger drafts remain recoverable locally.
            const payload = new Blob([body], { type: 'application/json' })
            if (payload.size <= 60000 && navigator.sendBeacon('/api/thesis', payload)) return
            void fetch('/api/thesis', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
                keepalive: payload.size <= 60000,
            }).catch(() => {})
        }

        const hide = () => { if (window.document.visibilityState === 'hidden') closeFlush() }
        const online = () => { void flush() }

        actions.current = {
            update(field, value, group) {
                if (!canEdit || draft[field] === value) return
                remember(group)
                draft = { ...draft, [field]: value, revision: remote ? draft.revision : base.revision }
                setDocument(draft)
                keepDraft()
                schedule()
            },
            undo: () => travel(false),
            redo: () => travel(true),
            flush,
            async restore(version) {
                do { if (!await flush()) return false } while (dirty())
                if (!same(draft, version)) remember()
                draft = { title: version.title, body: version.body, revision: base.revision }
                setDocument(draft)
                keepDraft()
                return flush()
            },
            recover(version) {
                if (dirty()) { setError('Wait for the current edit to reach the server before recovering another draft.'); return }
                clearUndo()
                recovered = version
                draft = version
                setDocument(draft)
                if (version.revision !== base.revision && !same(version, base)) {
                    remote = base
                    setConflict(true)
                    setError('This recovered draft is based on an older version. Choose which text to keep.')
                }
                keepDraft()
                schedule()
            },
            resolve(keep) {
                if (!remote) return
                clearUndo()
                base = remote
                draft = keep ? { ...draft, revision: base.revision } : base
                remote = null
                setConflict(false)
                setError('')
                setDocument(draft)
                keepDraft()
                schedule()
            },
        }

        if (canEdit) {
            try {
                let tabId = sessionStorage.getItem(prefix)
                if (!tabId) { tabId = crypto.randomUUID(); sessionStorage.setItem(prefix, tabId) }
                key = prefix + tabId
                const candidates = Object.keys(localStorage).filter(value => value.startsWith(prefix)).flatMap(value => {
                    try {
                        const item = JSON.parse(localStorage.getItem(value) || 'null')
                        return item && typeof item.title === 'string' && typeof item.body === 'string' && Number.isSafeInteger(item.revision)
                            ? [{ ...item, key: value } as Recovery] : []
                    } catch { return [] }
                }).filter(item => !same(item, initial)).sort((a, b) => b.savedAt - a.savedAt)
                const storedOwn = localStorage.getItem(key)
                if (storedOwn && same(JSON.parse(storedOwn), initial)) localStorage.removeItem(key)
                const own = candidates.find(item => item.key === key)
                if (own) actions.current!.recover(own)
                setRecoveries(candidates.filter(item => item.key !== key))
            } catch {
                setError('Browser recovery storage is unavailable. Keep this page open until your changes reach the server.')
            }
        }

        function connect() {
            socket = new WebSocket(`${config.url.api_wss}/thesis`)
            socket.onopen = () => { retryDelay = 1000 }
            socket.onmessage = event => {
                try { receive(JSON.parse(event.data)) } catch { /* Ignore malformed transport messages. */ }
            }
            socket.onclose = () => {
                if (!stopped) {
                    reconnect = setTimeout(connect, retryDelay)
                    retryDelay = Math.min(retryDelay * 2, 10000)
                }
            }
            socket.onerror = () => socket?.close()
        }
        connect()
        window.addEventListener('pagehide', closeFlush)
        window.document.addEventListener('visibilitychange', hide)
        window.addEventListener('online', online)
        return () => {
            closeFlush()
            stopped = true
            clearTimeout(timer)
            clearTimeout(reconnect)
            socket?.close()
            window.removeEventListener('pagehide', closeFlush)
            window.document.removeEventListener('visibilitychange', hide)
            window.removeEventListener('online', online)
        }
    }, [initial, canEdit])

    return {
        document, error, conflict, recoveries,
        update: (field: 'title' | 'body', value: string, group?: string) => actions.current?.update(field, value, group),
        canUndo: canEdit && !conflict && undoState.undo > 0,
        canRedo: canEdit && !conflict && undoState.redo > 0,
        undo: () => actions.current?.undo(),
        redo: () => actions.current?.redo(),
        flush: () => actions.current?.flush() ?? Promise.resolve(false),
        restore: (version: ThesisDocument) => actions.current?.restore(version) ?? Promise.resolve(false),
        recover: (version: Recovery) => actions.current?.recover(version),
        resolve: (keepDraft: boolean) => actions.current?.resolve(keepDraft),
    }
}
