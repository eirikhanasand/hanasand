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
        <section className='w-full rounded-lg border border-ui-border bg-ui-panel p-3'>
            <ImageSummary image={image} isExpanded={isExpanded} onToggle={onToggle} />
            {isExpanded ? <ImageDetails image={image} /> : null}
        </section>
    )
}
