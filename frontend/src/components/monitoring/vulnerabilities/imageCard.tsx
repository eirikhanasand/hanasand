import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import ImageDetails from './imageDetails'
import ImageSummary from './imageSummary'

export default function ImageCard({
    image,
    isExpanded,
    onToggle,
}: {
    image: ImageVulnerabilityReport
    isExpanded: boolean
    onToggle: () => void
}) {
    return (
        <section className='w-full rounded-2xl border border-white/10 bg-black/55 p-5'>
            <ImageSummary image={image} isExpanded={isExpanded} onToggle={onToggle} />
            {isExpanded ? <ImageDetails image={image} /> : null}
        </section>
    )
}
