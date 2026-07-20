import { AlertTriangle } from 'lucide-react'
import type { TiAdminOverview } from '@/utils/tiAdmin/ops'

export default function TiDataAvailability({ availability }: Pick<TiAdminOverview, 'availability'>) {
    if (availability.state === 'live') return null
    return (
        <div role='status' className='flex items-start gap-2 border border-ui-warning bg-ui-raised px-3 py-2 text-sm text-ui-text'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-ui-warning' />
            <p><span className='font-semibold'>Live intelligence data is incomplete.</span> Unavailable resources: {availability.failedResources.join(', ') || 'unknown'}.</p>
        </div>
    )
}
