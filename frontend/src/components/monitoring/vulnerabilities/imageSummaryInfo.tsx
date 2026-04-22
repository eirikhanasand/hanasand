import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import { Container } from 'lucide-react'

export default function ImageSummaryInfo({ image }: { image: ImageVulnerabilityReport }) {
    return (
        <>
            <div
                className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                    border border-violet-400/20 bg-linear-to-br from-violet-500/20
                    to-fuchsia-500/5 text-violet-200'
            >
                <Container className='h-5 w-5' />
            </div>
            <div className='min-w-0 flex-1 overflow-hidden'>
                <div className='flex items-center gap-3 overflow-hidden'>
                    <h2 className='truncate font-semibold text-white text-base'>{image.image}</h2>
                    <span className='shrink-0 text-sm text-white/80'>
                        Scanned {new Date(image.scannedAt).toLocaleString('nb-NO')}
                    </span>
                </div>
                {image.scanError && (
                    <div className='mt-2 truncate rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200'>
                        {image.scanError}
                    </div>
                )}
            </div>
        </>
    )
}
