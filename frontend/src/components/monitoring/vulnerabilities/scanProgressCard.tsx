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
        <div className='mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4'>
            <div className='flex items-center justify-between gap-4'>
                <div>
                    <div className='text-sm font-medium text-amber-200'>Scanning {scanStatus.currentImage || 'queued image'}…</div>
                    <div className='mt-1 text-sm text-amber-100/80'>
                        {scanStatus.completedImages} of {scanStatus.totalImages ?? '?'} images complete
                    </div>
                </div>
                <div className='text-right text-sm text-amber-100/80'>
                    <div>ETA</div>
                    <div className='font-medium text-amber-200'>{formatEta(scanStatus.estimatedCompletionAt, now)}</div>
                </div>
            </div>
            <div className='mt-3 h-2 overflow-hidden rounded-full bg-amber-950/50'>
                <div
                    className='h-full rounded-full bg-amber-300 transition-[width] duration-500'
                    style={{ width: `${width}%` }}
                />
            </div>
        </div>
    )
}
