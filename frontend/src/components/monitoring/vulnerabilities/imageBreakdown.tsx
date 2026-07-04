import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import { severityOrder } from './constants'
import InlineSeverityBadge from './inlineSeverityBadge'

export default function ImageBreakdown({ image }: { image: ImageVulnerabilityReport }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='text-xs font-medium uppercase tracking-[0.18em] text-ui-muted'>Dependency Breakdown</div>
            <div className='mt-4 flex flex-col gap-3'>
                {image.groups.length ? image.groups.map((group) => (
                    <div
                        key={`${image.image}-${group.source}`}
                        className='rounded-lg border border-ui-border bg-ui-raised p-4'
                    >
                        <div>
                            <div className='wrap-break-word font-medium text-ui-text'>{group.source}</div>
                            <div className='mt-1 text-sm text-ui-muted'>{group.total} findings</div>
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
                    <div className='rounded-lg border border-ui-border bg-ui-raised px-4 py-6 text-sm text-ui-muted'>
                        Dependency grouping is watching the scanner stream.
                    </div>
                )}
            </div>
        </div>
    )
}
