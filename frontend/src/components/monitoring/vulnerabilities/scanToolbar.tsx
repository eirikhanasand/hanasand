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
        <div className='mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#22334d] bg-[#0f172a] p-2'>
            <div className='flex flex-wrap items-center gap-2 pr-px'>
                <div className='px-2 text-sm font-medium text-[#aab7cc]'>
                    {props.sorting.images.length}/{props.data?.images.length || 0} images in queue
                </div>
                <div className='inline-flex rounded-md border border-[#22334d] bg-[#0b1220] p-0.5 text-sm'>
                    {(['impact', 'alphabetical'] as const).map((mode) => (
                        <button
                            key={mode}
                            type='button'
                            onClick={() => props.sorting.setSortMode(mode)}
                            className={`rounded px-2.5 py-1 transition ${
                                props.sorting.sortMode === mode ? 'bg-[#20365f] text-[#edf4ff]' : 'text-[#aab7cc] hover:bg-[#142033]'
                            }`}
                        >
                            {mode === 'impact' ? 'Impact' : 'A-Z'}
                        </button>
                    ))}
                </div>
                <div className='inline-flex rounded-md border border-[#22334d] bg-[#0b1220] p-0.5 text-sm'>
                    <button
                        type='button'
                        onClick={() => {
                            if (props.expansion.areAllExpanded) {
                                props.expansion.toggleExpandAll()
                            }
                        }}
                        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition ${
                            !props.expansion.areAllExpanded ? 'bg-[#20365f] text-[#edf4ff]' : 'text-[#aab7cc] hover:bg-[#142033]'
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
                        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition ${
                            props.expansion.areAllExpanded ? 'bg-[#20365f] text-[#edf4ff]' : 'text-[#aab7cc] hover:bg-[#142033]'
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
