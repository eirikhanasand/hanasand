import type { GetVulnerabilities, ImageVulnerabilityReport } from '@/utils/monitoring/types'

export type SortMode = 'impact' | 'alphabetical'

export type ScanNotice = {
    tone: 'info' | 'success' | 'error'
    title: string
    message: string
    dismissAt: number | null
}

export type VulnerabilityPageState = {
    data: GetVulnerabilities | null
    error: string | null
}

export type PageClientProps = {
    initialData: GetVulnerabilities | string
    initialQuery: string
    refreshAction: () => Promise<GetVulnerabilities | string>
    runScanAction: () => Promise<{ message: string, status: GetVulnerabilities['scanStatus'] } | string>
}

export type ImageList = ImageVulnerabilityReport[]
