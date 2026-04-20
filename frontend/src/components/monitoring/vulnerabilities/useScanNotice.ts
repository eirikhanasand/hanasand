import { useEffect, useRef, useState } from 'react'
import type { GetVulnerabilities } from '@/utils/monitoring/types'
import type { ScanNotice } from './types'

export default function useScanNotice(scanStatus: GetVulnerabilities['scanStatus']) {
    const [scanNotice, setScanNotice] = useState<ScanNotice | null>(null)
    const [now, setNow] = useState(() => Date.now())
    const previousIsRunningRef = useRef(scanStatus.isRunning)
    const dismissSeconds = scanNotice?.dismissAt ? Math.max(0, Math.ceil((scanNotice.dismissAt - now) / 1000)) : null
    const dismissProgress = scanNotice?.dismissAt ? Math.max(0, Math.min(100, ((scanNotice.dismissAt - now) / 5000) * 100)) : 0

    useEffect(() => {
        if (!scanStatus.isRunning && !scanNotice?.dismissAt) return
        const intervalId = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(intervalId)
    }, [scanNotice?.dismissAt, scanStatus.isRunning])

    useEffect(() => {
        if (scanNotice?.dismissAt && scanNotice.dismissAt <= now) setScanNotice(null)
    }, [now, scanNotice])

    useEffect(() => {
        if (previousIsRunningRef.current && !scanStatus.isRunning) {
            setScanNotice(scanStatus.lastError
                ? { tone: 'error', title: 'Scan failed', message: scanStatus.lastError, dismissAt: null }
                : {
                    tone: 'success',
                    title: 'Scan complete',
                    message: 'Fresh vulnerability results are ready to review.',
                    dismissAt: Date.now() + 5000,
                })
        }
        previousIsRunningRef.current = scanStatus.isRunning
    }, [scanStatus.isRunning, scanStatus.lastError])

    return { now, scanNotice, setScanNotice, dismissSeconds, dismissProgress }
}
