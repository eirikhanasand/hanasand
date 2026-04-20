import type { ImageVulnerabilityReport } from '@/utils/monitoring/types'
import { severityOrder } from './constants'
import InlineSeverityBadge from './inlineSeverityBadge'

export default function ImageBreakdown({ image }: { image: ImageVulnerabilityReport }) {
    return (
        <div className='rounded-xl border border-login-100/10 bg-login-50/5 p-4'>
            <div className='text-xs font-medium uppercase tracking-[0.18em] text-login-200'>Dependency Breakdown</div>
            <div className='mt-4 flex flex-col gap-3'>
                {image.groups.length ? image.groups.map((group) => (
                    <div
                        key={`${image.image}-${group.source}`}
                        className='rounded-xl border border-login-100/10 bg-login-900/50 p-4'
                    >
                        <div>
                            <div className='wrap-break-words font-medium text-login-50'>{group.source}</div>
                            <div className='mt-1 text-sm text-login-200'>{group.total} findings</div>
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
                    <div className='rounded-xl border border-login-100/10 bg-login-900/50 px-4 py-6 text-sm text-login-100'>
                        No dependency grouping available for this image.
                    </div>
                )}
            </div>
        </div>
    )
}
