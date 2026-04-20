import { startTransition } from 'react'
import type { GetVulnerabilities } from '@/utils/monitoring/types'
import type { PageClientProps, VulnerabilityPageState } from './types'
import type useScanNotice from './useScanNotice'

type Args = {
    notice: ReturnType<typeof useScanNotice>
    refresh: () => Promise<void>
    runScanAction: PageClientProps['runScanAction']
    setPageState: React.Dispatch<React.SetStateAction<VulnerabilityPageState>>
}

export default function useRunScan({ notice, refresh, runScanAction, setPageState }: Args) {
    return async function handleRunScan() {
        notice.setScanNotice(null)
        const response = await runScanAction()
        if (typeof response === 'string') {
            return notice.setScanNotice({
                tone: 'error',
                title: 'Scan could not start',
                message: response,
                dismissAt: null,
            })
        }

        notice.setScanNotice({
            tone: 'info',
            title: 'Scan started in the background',
            message: response.message,
            dismissAt: null,
        })
        startTransition(() => setPageState(prev => ({
            ...prev,
            data: prev.data
                ? { ...prev.data, scanStatus: response.status }
                : {
                    generatedAt: null,
                    imageCount: 0,
                    images: [],
                    scanStatus: response.status,
                } as GetVulnerabilities
        })))
        await refresh()
    }
}
