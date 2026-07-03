import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import { severityOrder } from './constants'
import InlineSeverityBadge from './inlineSeverityBadge'

export default function ImageBreakdown({ image }: { image: ImageVulnerabilityReport }) {
    return (
        <div className='rounded-xl border border-[#26354d] bg-[#101a29] p-4'>
            <div className='text-xs font-medium uppercase tracking-[0.18em] text-[#91a1b8]'>Dependency Breakdown</div>
            <div className='mt-4 flex flex-col gap-3'>
                {image.groups.length ? image.groups.map((group) => (
                    <div
                        key={`${image.image}-${group.source}`}
                        className='rounded-xl border border-[#26354d] bg-[#070d15] p-4'
                    >
                        <div>
                            <div className='wrap-break-word font-medium text-[#e8eef8]'>{group.source}</div>
                            <div className='mt-1 text-sm text-[#91a1b8]'>{group.total} findings</div>
                        </div>
                        <div className='mt-3 flex flex-wrap gap-2'>
                            {severityOrder.map((severity) => (
                                <InlineSeverityBadge
                                    key={`${group.source}-${severity}`}
                                    severity={severity}
                                    count={group.severity[severity]}
                                />
                            ))}
                        </div>
                    </div>
                )) : (
                    <div className='rounded-xl border border-[#26354d] bg-[#070d15] px-4 py-6 text-sm text-[#c8d3e3]'>
                        Dependency grouping is watching the scanner stream.
                    </div>
                )}
            </div>
        </div>
    )
}
