import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import ImageBreakdown from './imageBreakdown'
import ImageFindings from './imageFindings'

export default function ImageDetails({ image }: { image: ImageVulnerabilityReport }) {
    return (
        <div className='mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]'>
            <ImageBreakdown image={image} />
            <ImageFindings image={image} />
        </div>
    )
}
