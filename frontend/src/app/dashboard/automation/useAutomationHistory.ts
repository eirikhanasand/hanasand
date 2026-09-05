'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InitialAutomationData } from '@/utils/automations/server'
import { fetchAutomation, type AgentAutomationRun } from '@/utils/automations/client'

export default function useAutomationHistory(id: string | undefined, from: string, to: string, initial?: InitialAutomationData['detail'], initialError = '') {
    const seeded = initial?.automation.id === id && !from && !to ? initial : undefined
    const [runs, setRuns] = useState<AgentAutomationRun[]>(seeded?.runs || [])
    const [total, setTotal] = useState(seeded?.total || 0)
    const [hasMore, setHasMore] = useState(Boolean(seeded?.nextCursor))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(initialError)
    const refresh = useRef<() => void>(() => {})
    const action = useRef<() => void>(() => {})

    useEffect(() => {
        let stopped = false
        let busy = false
        let cursor: string | null = seeded?.nextCursor || null
        let rows: AgentAutomationRun[] = seeded?.runs || []
        setRuns(rows)
        setTotal(seeded?.total || 0)
        setHasMore(Boolean(cursor))
        setError('')
        async function load(older = false) {
            if (!id || busy || older && !cursor) return
            busy = true
            setLoading(true)
            try {
                const page = await fetchAutomation(id, { cursor: older ? cursor || undefined : undefined, from, to })
                if (stopped) return
                // Refresh recent results without discarding older pages already loaded.
                const merged = new Map(rows.map(run => [run.id, run]))
                page.runs.forEach(run => merged.set(run.id, run))
                rows = [...merged.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id))
                if (older || !cursor && rows.length <= 50) cursor = page.nextCursor
                setRuns(rows)
                setTotal(page.total)
                setHasMore(Boolean(cursor) && rows.length < page.total)
                setError('')
            } catch (failure) {
                if (!stopped) setError(failure instanceof Error ? failure.message : 'Unable to load checks.')
            } finally {
                busy = false
                if (!stopped) setLoading(false)
            }
        }
        action.current = () => { void load(Boolean(cursor)) }
        refresh.current = () => { void load() }
        void load()
        const timer = window.setInterval(() => { void load() }, 15_000)
        return () => { stopped = true; window.clearInterval(timer) }
    }, [id, from, to])
    return { runs, total, hasMore, loading, error, loadMore: useCallback(() => action.current(), []), refresh: useCallback(() => refresh.current(), []) }
}
