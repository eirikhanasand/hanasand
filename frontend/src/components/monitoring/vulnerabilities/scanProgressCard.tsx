import type { GetVulnerabilities } from '@/utils/monitoring/types'
import { formatEta } from './helpers'

export default function ScanProgressCard({
    now,
    scanStatus,
}: {
    now: number
    scanStatus: GetVulnerabilities['scanStatus']
}) {
    const width = scanStatus.totalImages ? (scanStatus.completedImages / Math.max(scanStatus.totalImages, 1)) * 100 : 0

    return (
        <div className='mt-4 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-4 py-4'>
            <div className='flex items-center justify-between gap-4'>
                <div>
                    <div className='text-sm font-medium text-ui-warning'>Scanning {scanStatus.currentImage || 'queued image'}…</div>
                    <div className='mt-1 text-sm text-ui-warning'>
                        {scanStatus.completedImages} of {scanStatus.totalImages ?? '?'} images complete
                    </div>
                </div>
                <div className='text-right text-sm text-ui-warning'>
                    <div>ETA</div>
                    <div className='font-medium text-ui-warning'>{formatEta(scanStatus.estimatedCompletionAt, now)}</div>
                </div>
            </div>
            <div className='mt-3 h-2 overflow-hidden rounded-full bg-ui-border'>
                <div
                    className='h-full rounded-full bg-ui-warning transition-[width] duration-500'
                    style={{ width: `${width}%` }}
                />
            </div>
        </div>
    )
}
