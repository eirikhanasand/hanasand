'use client'

import { BellRing } from 'lucide-react'
import { displayRequirementText, type AlertPacket } from '../pageModel'
import Panel from './panel'

export default function AlertPacketPanel({ packet }: { packet: AlertPacket }) {
    return (
        <Panel title='Evidence' description='Alert and case context from the selected finding. Delivery stays in the authenticated console.' icon={<BellRing className='h-4 w-4' />}>
            <div className='grid gap-3'>
                <div>
                    <p className='text-sm font-semibold text-ui-text'>{packet.title}</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>{packet.customerValue}</p>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Evidence basis</p>
                    <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-muted'>
                        {packet.evidenceBasis.map(item => <li key={item}>{displayRequirementText(item)}</li>)}
                    </ul>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Routing</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>{packet.routing}</p>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Watch terms carried forward</p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                        {packet.watchTerms.map(term => <span key={term} className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'>{term}</span>)}
                    </div>
                </div>
                {packet.blockedUntil.length ? (
                    <div className='rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3'>
                        <p className='text-xs font-semibold uppercase text-ui-warning dark:text-ui-warning'>Waiting on</p>
                        <ul className='mt-2 grid list-disc gap-1 pl-4 text-xs leading-5 text-ui-warning'>
                            {packet.blockedUntil.map(item => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                ) : null}
            </div>
        </Panel>
    )
}
