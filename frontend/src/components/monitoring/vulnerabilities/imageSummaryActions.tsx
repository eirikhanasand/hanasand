import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import { ChevronDown } from 'lucide-react'
import { severityClasses, severityLabel, severityOrder } from './constants'
import MiniStat from './miniStat'

export default function ImageSummaryActions({
    image,
    isExpanded,
    onToggle,
}: {
    image: ImageVulnerabilityReport
    isExpanded: boolean
    onToggle: () => void
}) {
    return (
        <div className='flex shrink-0 items-center gap-1.5 overflow-x-auto'>
            <MiniStat label='Total' value={String(image.totalVulnerabilities)} compact />
            {severityOrder.filter(severity => image.severity[severity] > 0).map((severity) => (
                <span
                    key={`${image.image}-${severity}`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${severityClasses[severity]}`}
                >
                    <span>{severityLabel[severity]}</span>
                    <span>{image.severity[severity]}</span>
                </span>
            ))}
            {image.totalVulnerabilities === 0 ? (
                <span className='inline-flex items-center rounded-full border border-[#285c3b] bg-[#102318] px-2 py-0.5 text-xs font-semibold text-[#7bd39a]'>clear</span>
            ) : null}
            <button
                type='button'
                onClick={(event) => {
                    event.stopPropagation()
                    onToggle()
                }}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? `Collapse ${image.image}` : `Expand ${image.image}`}
                className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md
                    border border-[#22334d] bg-[#0b1220] text-[#aab7cc] transition
                    hover:border-[#315b92] hover:bg-[#142033]'
            >
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
        </div>
    )
}
