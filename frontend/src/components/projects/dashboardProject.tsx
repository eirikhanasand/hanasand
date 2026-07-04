'use client'

import Link from 'next/link'
import { ExternalLink, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Notify from '../notify/notify'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteProject from '@/utils/projects/deleteProject'
import prettyDate from '@/utils/date/prettyDate'

export default function DashboardProject({ project }: { project: Project }) {
    const [deleted, setDeleted] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const router = useRouter()

    async function handleDelete() {
        const result = await deleteProject(project.alias)
        if (result.status === 200) {
            setDeleted(true)
            router.refresh()
        } else {
            setError(result.message)
        }
    }

    if (deleted) return null

    return (
        <div className='group'>
            <div className='grid gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 py-2 transition hover:border-ui-border hover:bg-ui-primary/10 lg:grid-cols-[minmax(0,1.5fr)_7rem_8rem_8rem_auto] lg:items-center'>
                <div className='flex min-w-0 flex-1 flex-col gap-1 text-ui-muted sm:flex-row sm:items-center sm:justify-between sm:gap-3'>
                    <div className='min-w-0'>
                        <h3 className='truncate text-sm font-semibold text-ui-text'>{project.alias || 'Untitled project'}</h3>
                        <p className='mt-0.5 truncate text-xs text-ui-muted'>Owner {project.owner || 'attaching'}</p>
                    </div>
                </div>
                <span className='text-xs font-semibold text-ui-text'>{project.file_count || 0} files</span>
                <span className='text-xs text-ui-muted'>{project.editors?.length || 0} editor{project.editors?.length === 1 ? '' : 's'}</span>
                <span className='text-xs text-ui-muted'>{prettyDate(project.last_updated)}</span>
                <div className='flex shrink-0 items-center gap-1.5 justify-self-end'>
                    <Link href={`/p/${project.alias}`} className='inline-flex h-8 items-center gap-1.5 rounded-md border border-ui-border bg-ui-raised px-2.5 text-xs font-semibold text-ui-text hover:border-ui-primary/35 hover:bg-ui-primary/10'>
                        <ExternalLink className='h-3.5 w-3.5' />
                        Open
                    </Link>
                    <button type='button' onClick={() => void handleDelete()} aria-label={`Delete project ${project.alias}`} className='inline-flex h-8 w-8 items-center justify-center rounded-md border border-ui-danger/35 bg-ui-danger/10 text-ui-danger hover:bg-ui-danger/15'>
                        <Trash2 className='h-4 w-4' />
                    </button>
                </div>
            </div>
            {error && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={error} className='min-w-full px-4' />
            </div>}
        </div>
    )
}
