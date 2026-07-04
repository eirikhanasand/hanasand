import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import { Container } from 'lucide-react'

export default function ImageSummaryInfo({ image }: { image: ImageVulnerabilityReport }) {
    return (
        <>
            <div
                className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                    border border-ui-primary/35 bg-ui-primary/10 text-ui-primary'
            >
                <Container className='h-5 w-5' />
            </div>
            <div className='min-w-0 flex-1 overflow-hidden'>
                <div className='flex items-center gap-2 overflow-hidden'>
                    <h2 className='truncate text-sm font-semibold text-ui-text'>{image.image}</h2>
                    <span className='shrink-0 text-xs text-ui-muted'>
                        {formatScannedAt(image.scannedAt)}
                    </span>
                </div>
                {image.scanError && (
                    <div className='mt-1 truncate rounded-md border border-ui-danger/35 bg-ui-danger/10 px-2 py-1 text-xs text-ui-danger'>
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
