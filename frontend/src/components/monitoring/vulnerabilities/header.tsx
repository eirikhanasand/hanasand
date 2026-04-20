import type { GetVulnerabilities } from '@/utils/monitoring/types'
import type { PageClientProps, VulnerabilityPageState } from './types'
import type useExpandedImages from './useExpandedImages'
import type useScanNotice from './useScanNotice'
import type useSortedImages from './useSortedImages'
import SummaryGrid from './summaryGrid'
import ScanToolbar from './scanToolbar'
import ScanNoticeCard from './scanNoticeCard'
import ScanProgressCard from './scanProgressCard'

type Props = Pick<PageClientProps, 'runScanAction'> & Pick<VulnerabilityPageState, 'data'> & {
    isRefreshing: boolean
    notice: ReturnType<typeof useScanNotice>
    refresh: () => Promise<void>
    scanStatus: GetVulnerabilities['scanStatus']
    setPageState: React.Dispatch<React.SetStateAction<VulnerabilityPageState>>
    sorting: ReturnType<typeof useSortedImages>
    expansion: ReturnType<typeof useExpandedImages>
}

export default function VulnerabilityHeader(props: Props) {
    return (
        <header className='w-full'>
            <SummaryGrid data={props.data} scanStatus={props.scanStatus} />
            <ScanToolbar {...props} />
            {props.notice.scanNotice && (
                <ScanNoticeCard
                    notice={props.notice.scanNotice}
                    dismissProgress={props.notice.dismissProgress}
                    dismissSeconds={props.notice.dismissSeconds}
                />
            )}
            {props.scanStatus.isRunning && (
                <ScanProgressCard now={props.notice.now} scanStatus={props.scanStatus} />
            )}
        </header>
    )
}
