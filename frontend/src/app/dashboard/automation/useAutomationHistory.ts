'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InitialAutomationData } from '@/utils/automations/server'
import { fetchAutomation, type AgentAutomationRun, type MonitoringIssue } from '@/utils/automations/client'

export default function useAutomationHistory(id: string | undefined, from: string, to: string, initial?: InitialAutomationData['detail'], initialError = '') {
    const seeded = initial?.automation.id === id && !from && !to ? initial : undefined
    const [runs, setRuns] = useState<AgentAutomationRun[]>(seeded?.runs || [])
    const [issues, setIssues] = useState<MonitoringIssue[]>(seeded?.issues || [])
    const [total, setTotal] = useState(seeded?.total || 0)
    const [hasMore, setHasMore] = useState(Boolean(seeded?.nextPage))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(initialError)
    const refresh = useRef<() => void>(() => {})
    const action = useRef<() => void>(() => {})

    useEffect(() => {
        let stopped = false
        let busy = false
        let nextPage: number | null = seeded?.nextPage || null
        let rows: AgentAutomationRun[] = seeded?.runs || []
        setRuns(rows)
        setIssues(seeded?.issues || [])
        setTotal(seeded?.total || 0)
        setHasMore(Boolean(nextPage))
        setError('')
        async function load(older = false) {
            if (!id || busy || older && !nextPage) return
            busy = true
            setLoading(true)
            try {
                const page = await fetchAutomation(id, { page: older ? nextPage || 1 : 1, from, to })
                if (stopped) return
                // Refresh recent results without discarding older pages already loaded.
                const merged = new Map(rows.map(run => [run.id, run]))
                page.runs.forEach(run => merged.set(run.id, run))
                rows = [...merged.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id))
                if (older || !nextPage && rows.length <= 50) nextPage = page.nextPage
                setRuns(rows)
                setIssues(page.issues || [])
                setTotal(page.total)
                setHasMore(Boolean(nextPage) && rows.length < page.total)
                setError('')
            } catch (failure) {
                if (!stopped) setError(failure instanceof Error ? failure.message : 'Unable to load checks.')
            } finally {
                busy = false
                if (!stopped) setLoading(false)
            }
        }
        action.current = () => { void load(Boolean(nextPage)) }
        refresh.current = () => { void load() }
        void load()
        const timer = window.setInterval(() => { void load() }, 15_000)
        return () => { stopped = true; window.clearInterval(timer) }
    }, [id, from, to])
    return { runs, issues, total, hasMore, loading, error, loadMore: useCallback(() => action.current(), []), refresh: useCallback(() => refresh.current(), []) }
}
