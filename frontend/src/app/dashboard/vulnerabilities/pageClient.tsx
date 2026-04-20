'use client'

import { useEffect } from 'react'
import VulnerabilityView from '@/components/monitoring/vulnerabilities/view'
import useExpandedImages from '@/components/monitoring/vulnerabilities/useExpandedImages'
import usePageState from '@/components/monitoring/vulnerabilities/usePageState'
import useScanNotice from '@/components/monitoring/vulnerabilities/useScanNotice'
import useSortedImages from '@/components/monitoring/vulnerabilities/useSortedImages'
import { getFallbackStatus } from '@/components/monitoring/vulnerabilities/helpers'
import type { PageClientProps } from '@/components/monitoring/vulnerabilities/types'

export default function PageClient(props: PageClientProps) {
    const { data, error, isRefreshing, refresh, setPageState } = usePageState(props)
    const scanStatus = data?.scanStatus || getFallbackStatus()
    const sorting = useSortedImages(data, props.initialQuery)
    const expansion = useExpandedImages(sorting.images)
    const notice = useScanNotice(scanStatus)

    useEffect(() => {
        if (!scanStatus.isRunning) {
            return
        }

        const intervalId = setInterval(() => {
            void refresh()
        }, 3000)

        return () => clearInterval(intervalId)
    }, [refresh, scanStatus.isRunning])

    return (
        <VulnerabilityView
            data={data}
            error={error}
            isRefreshing={isRefreshing}
            notice={notice}
            refresh={refresh}
            scanStatus={scanStatus}
            setPageState={setPageState}
            sorting={sorting}
            expansion={expansion}
            runScanAction={props.runScanAction}
        />
    )
}
