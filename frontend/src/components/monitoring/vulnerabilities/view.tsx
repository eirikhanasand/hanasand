import type { GetVulnerabilities } from '@/utils/monitoring/types'
import type { PageClientProps, VulnerabilityPageState } from './types'
import type useExpandedImages from './useExpandedImages'
import type useScanNotice from './useScanNotice'
import type useSortedImages from './useSortedImages'
import VulnerabilityHeader from './header'
import VulnerabilityErrorState from './errorState'
import VulnerabilityEmptyState from './emptyState'
import VulnerabilityList from './vulnerabilityList'

type Props = Pick<PageClientProps, 'runScanAction'> & Pick<VulnerabilityPageState, 'data' | 'error'> & {
    isRefreshing: boolean
    notice: ReturnType<typeof useScanNotice>
    refresh: () => Promise<void>
    scanStatus: GetVulnerabilities['scanStatus']
    setPageState: React.Dispatch<React.SetStateAction<VulnerabilityPageState>>
    sorting: ReturnType<typeof useSortedImages>
    expansion: ReturnType<typeof useExpandedImages>
}

export default function VulnerabilityView(props: Props) {
    return (
        <div className='h-full overflow-y-auto'>
            <div className='flex w-full flex-col gap-4 pb-4'>
                <VulnerabilityHeader {...props} />
                {props.error
                    ? <VulnerabilityErrorState error={props.error} />
                    : props.sorting.images.length
                        ? <VulnerabilityList images={props.sorting.images} expansion={props.expansion} />
                        : <VulnerabilityEmptyState />}
            </div>
        </div>
    )
}
