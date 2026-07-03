import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import ImageBreakdown from './imageBreakdown'
import ImageFindings from './imageFindings'

export default function ImageDetails({ image }: { image: ImageVulnerabilityReport }) {
    return (
        <div className='mt-5 grid gap-4'>
            <details className='overflow-hidden rounded-lg border border-ui-border bg-ui-raised' data-testid='vulnerability-image-breakdown-disclosure'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/30 [&::-webkit-details-marker]:hidden'>
                    <span>Package and severity breakdown</span>
                    <span className='text-xs font-medium text-ui-muted'>{image.groups.length} groups</span>
                </summary>
                <div className='border-t border-ui-border p-3' data-testid='vulnerability-image-breakdown'>
                    <ImageBreakdown image={image} />
                </div>
            </details>
            <ImageFindings image={image} />
        </div>
    )
}
