'use client'

import { decisionStepStatusClass, decisionStepStatusLabel, sourceActivationActionLabel, sourceActivationExecutionClass, sourceActivationExecutionLabel, type DecisionStep } from '../pageModel'
import { ShieldAlert } from 'lucide-react'
import { TiSearchResponse } from '@/utils/ti/search'
import Panel from './panel'

export default function SourceActivationPanel({ activation }: { activation: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow'] }) {
    const blockedCount = activation.actions.filter(action => action.execution === 'blocked').length
    const approvalCount = activation.actions.filter(action => action.execution === 'human_approval_required').length
    const state: DecisionStep['status'] = blockedCount ? 'blocked' : approvalCount || activation.dryRunOnly ? 'review' : 'ready'
    return (
        <Panel title='Source Activation' description='Source actions from collection policy. Analysts can stage review, but source changes require authenticated approval.' icon={<ShieldAlert className='h-4 w-4' />}>
            <div data-ti-source-activation='true' className='grid min-w-0 gap-3'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                        <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Activation state</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                            {activation.dryRunOnly ? 'Actions are review-only until a console user approves source changes.' : 'Source actions are ready for authenticated review.'}
                        </p>
                    </div>
                    <span className={decisionStepStatusClass(state)}>{decisionStepStatusLabel(state)}</span>
                </div>
                <div className='grid min-w-0 gap-2'>
                    {activation.actions.map(action => (
                        <div key={`${action.action}-${action.sourceId ?? 'none'}-${action.execution}`} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{sourceActivationActionLabel(action.action)}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{action.reason}</p>
                                </div>
                                <span className={sourceActivationExecutionClass(action.execution)}>{sourceActivationExecutionLabel(action.execution)}</span>
                            </div>
                            {action.sourceId ? <p className='mt-1 text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>source reference linked</p> : null}
                        </div>
                    ))}
                </div>
            </div>
        </Panel>
    )
}
