'use client'

import { type ActorArtifact, type ActorArtifactKind } from '@/utils/ti/actorWorkbench'
import InfoTip from './info-tip'

export default function DossierList({ title, description, values, artifactKind, artifactByLookup, selectedArtifactId, onSelectArtifact }: {
    title: string
    description?: string
    values: string[]
    artifactKind?: ActorArtifactKind
    artifactByLookup?: Map<string, ActorArtifact>
    selectedArtifactId?: string
    onSelectArtifact?: (artifactId: string) => void
}) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex min-w-0 items-center gap-1.5'>
                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{title}</p>
                {description ? <InfoTip label={description} /> : null}
            </div>
            <div className='mt-2 grid grid-cols-1 gap-1.5 sm:flex sm:flex-wrap'>
                {values.length ? values.slice(0, 8).map(value => {
                    const artifact = artifactKind ? artifactByLookup?.get(`${artifactKind}:${value.toLowerCase()}`) : undefined
                    if (!artifact || !onSelectArtifact) {
                        return <span key={value} className='inline-flex min-h-8 w-full max-w-full items-center wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text sm:w-auto'>{value}</span>
                    }
                    const active = artifact.id === selectedArtifactId
                    return (
                        <button
                            key={value}
                            type='button'
                            onClick={() => onSelectArtifact(artifact.id)}
                            className={`inline-flex min-h-8 w-full max-w-full items-center wrap-break-word rounded-md border px-2 py-1 text-left text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 sm:w-auto ${active ? 'border-ui-primary bg-ui-primary/10 text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text hover:border-ui-primary/35 hover:bg-ui-raised dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:border-ui-primary/35 dark:hover:bg-ui-raised'}`}
                        >
                            {value}
                        </button>
                    )
                }) : <span className='text-xs text-ui-muted dark:text-ui-muted'>Add observed values to compare.</span>}
            </div>
        </div>
    )
}
