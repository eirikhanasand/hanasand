import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import { severityOrder } from './constants'
import InlineSeverityBadge from './inlineSeverityBadge'

export default function ImageBreakdown({ image }: { image: ImageVulnerabilityReport }) {
    return (
        <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
            <div className='text-xs font-medium uppercase tracking-[0.18em] text-white/60'>Dependency Breakdown</div>
            <div className='mt-4 flex flex-col gap-3'>
                {image.groups.length ? image.groups.map((group) => (
                    <div
                        key={`${image.image}-${group.source}`}
                        className='rounded-xl border border-white/10 bg-black/50 p-4'
                    >
                        <div>
                            <div className='wrap-break-word font-medium text-white'>{group.source}</div>
                            <div className='mt-1 text-sm text-white/60'>{group.total} findings</div>
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
                    <div className='rounded-xl border border-white/10 bg-black/50 px-4 py-6 text-sm text-white/80'>
                        No dependency grouping available for this image.
                    </div>
                )}
            </div>
        </div>
    )
}
