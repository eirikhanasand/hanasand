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
        <section className='w-full rounded-lg border border-[#22334d] bg-[#0f172a] p-3'>
            <ImageSummary image={image} isExpanded={isExpanded} onToggle={onToggle} />
            {isExpanded ? <ImageDetails image={image} /> : null}
        </section>
    )
}
