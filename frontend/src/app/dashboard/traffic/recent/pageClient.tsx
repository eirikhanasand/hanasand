'use client'

import { useEffect, useState } from 'react'
import { RecentTrafficTable } from '@/components/monitoring/traffic/traffic'
import type { TrafficRecords } from '@/utils/monitoring/types'

export default function TrafficRecentClient({ initialRecords, selectedDomain }: {
    initialRecords: TrafficRecords
    selectedDomain?: string
}) {
    const [records, setRecords] = useState(initialRecords.result)

    useEffect(() => {
        let stopped = false
        let timer: ReturnType<typeof setTimeout> | null = null

        async function refresh() {
            try {
                const params = new URLSearchParams({ mode: 'snapshot', ...(selectedDomain ? { domain: selectedDomain } : {}) })
                const response = await fetch(`/api/live-traffic?${params}`, { cache: 'no-store' })
                if (!response.ok) throw new Error(`Traffic request returned ${response.status}`)
                const snapshot = await response.json() as { records?: TrafficRecords | null }
                if (!stopped && snapshot.records && Array.isArray(snapshot.records.result)) setRecords(snapshot.records.result)
            } catch {
                // Keep the last successful request list visible until a later refresh succeeds.
            } finally {
                if (!stopped) timer = setTimeout(refresh, 30_000)
            }
        }

        timer = setTimeout(refresh, 30_000)
        return () => {
            stopped = true
            if (timer) clearTimeout(timer)
        }
    }, [selectedDomain])

    return <RecentTrafficTable records={records} />
}
