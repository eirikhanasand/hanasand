'use client'

import { actorGeoProfile } from '@/utils/ti/actorProfile'
import { displayRequirementText } from '../pageModel'

export default function MapPointActionRow({ point, active, onFocus }: { point: ReturnType<typeof actorGeoProfile>['points'][number]; active: boolean; onFocus: () => void }) {
    return (
        <div
            data-ti-geo-context-actions='true'
            className={`rounded-lg border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${active ? 'border-ui-primary bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-primary/10' : 'border-ui-border bg-ui-panel hover:border-ui-border hover:bg-ui-panel dark:border-ui-border dark:bg-ui-raised dark:hover:border-ui-border dark:hover:bg-ui-raised'}`}
        >
            <button type='button' onClick={onFocus} className='grid min-h-9 w-full min-w-0 items-center gap-1 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                <span className='flex min-w-0 flex-wrap items-center justify-between gap-2'>
                    <span className='min-w-0 wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{point.label}</span>
                    <span className={point.role === 'operator' ? 'whitespace-nowrap text-ui-primary dark:text-ui-primary' : 'whitespace-nowrap text-ui-text dark:text-ui-text'}>{point.role === 'operator' ? 'Origin' : 'Target'}</span>
                </span>
            </button>
            <p className='mt-1 leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(point.detail)}</p>
        </div>
    )
}
