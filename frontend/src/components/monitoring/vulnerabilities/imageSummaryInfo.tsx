import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import { Container } from 'lucide-react'

export default function ImageSummaryInfo({ image }: { image: ImageVulnerabilityReport }) {
    return (
        <>
            <div
                className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                    border border-[#315b92] bg-[#10223d] text-[#9db4ff]'
            >
                <Container className='h-5 w-5' />
            </div>
            <div className='min-w-0 flex-1 overflow-hidden'>
                <div className='flex items-center gap-2 overflow-hidden'>
                    <h2 className='truncate text-sm font-semibold text-[#edf4ff]'>{image.image}</h2>
                    <span className='shrink-0 text-xs text-[#8795ad]'>
                        {formatScannedAt(image.scannedAt)}
                    </span>
                </div>
                {image.scanError && (
                    <div className='mt-1 truncate rounded-md border border-[#6d3a20] bg-[#29130b] px-2 py-1 text-xs text-[#ff9b6b]'>
                        {image.scanError}
                    </div>
                )}
            </div>
        </>
    )
}

function formatScannedAt(value: string) {
    const time = new Date(value)
    if (!value || Number.isNaN(time.getTime())) return 'scan queued'
    return `scanned ${time.toLocaleString('nb-NO')}`
}
