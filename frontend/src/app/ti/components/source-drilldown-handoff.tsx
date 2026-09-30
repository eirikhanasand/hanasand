'use client'

import { decisionStepStatusClass, displayRequirementList, displayRequirementText } from '../pageModel'

export default function SourceDrilldownHandoff({ label, ready, endpoint, missing }: { label: string; ready: boolean; endpoint: string; missing: string[] }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{label}</p>
                    <p className='mt-1 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(endpoint)}</p>
                </div>
                <span className={ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{ready ? 'ready' : 'syncing'}</span>
            </div>
            <p className={ready ? 'mt-1 text-[11px] leading-5 text-ui-success dark:text-ui-success' : 'mt-1 wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning'}>
                {ready ? 'Required source and routing context is present.' : displayRequirementList(missing.slice(0, 2)) || 'Required source and routing context is not attached.'}
            </p>
        </div>
    )
}
