import type { GetVulnerabilities } from '@/utils/monitoring/types'
import type { PageClientProps, VulnerabilityPageState } from './types'
import RunScanButton from './runScanButton'
import type useExpandedImages from './useExpandedImages'
import useRunScan from './useRunScan'
import type useScanNotice from './useScanNotice'
import type useSortedImages from './useSortedImages'
import { LayoutGrid, Rows3 } from 'lucide-react'

type Props = Pick<PageClientProps, 'runScanAction'> & {
    data: GetVulnerabilities | null
    isRefreshing: boolean
    notice: ReturnType<typeof useScanNotice>
    refresh: () => Promise<void>
    scanStatus: GetVulnerabilities['scanStatus']
    setPageState: React.Dispatch<React.SetStateAction<VulnerabilityPageState>>
    sorting: ReturnType<typeof useSortedImages>
    expansion: ReturnType<typeof useExpandedImages>
}

export default function ScanToolbar(props: Props) {
    const handleRunScan = useRunScan(props)

    return (
        <div className='mt-4 flex gap-3 justify-between'>
            <div className='flex items-center gap-3 pr-px'>
                <div className='text-sm text-white/60'>
                    Showing {props.sorting.images.length} of {props.data?.images.length || 0} images
                </div>
                <div className='inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-sm'>
                    {(['impact', 'alphabetical'] as const).map((mode) => (
                        <button
                            key={mode}
                            type='button'
                            onClick={() => props.sorting.setSortMode(mode)}
                            className={`rounded-md px-3 py-1.5 transition ${
                                props.sorting.sortMode === mode ? 'bg-[#e25822] text-white' : 'text-white/60 hover:bg-white/10'
                            }`}
                        >
                            {mode === 'impact' ? 'Impact' : 'A-Z'}
                        </button>
                    ))}
                </div>
                <div className='inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-sm'>
                    <button
                        type='button'
                        onClick={() => {
                            if (props.expansion.areAllExpanded) {
                                props.expansion.toggleExpandAll()
                            }
                        }}
                        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 transition ${
                            !props.expansion.areAllExpanded ? 'bg-[#e25822] text-white' : 'text-white/60 hover:bg-white/10'
                        }`}
                    >
                        <Rows3 className='h-4.5 w-4.5' />
                        Compact
                    </button>
                    <button
                        type='button'
                        onClick={() => {
                            if (!props.expansion.areAllExpanded) {
                                props.expansion.toggleExpandAll()
                            }
                        }}
                        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 transition ${
                            props.expansion.areAllExpanded ? 'bg-[#e25822] text-white' : 'text-white/60 hover:bg-white/10'
                        }`}
                    >
                        <LayoutGrid className='h-4.5 w-4.5' />
                        Expanded
                    </button>
                </div>
                <RunScanButton
                    disabled={props.scanStatus.isRunning || props.isRefreshing}
                    isRunning={props.scanStatus.isRunning}
                    onClick={handleRunScan}
                />
            </div>
        </div>
    )
}
