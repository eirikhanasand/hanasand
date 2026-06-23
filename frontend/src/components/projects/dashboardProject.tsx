'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
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
            <div className='flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-[#e0e5ed] hover:bg-[#fbfcfe]'>
                <div className='flex w-full items-center justify-between gap-3 text-[#596170]'>
                    <div className='min-w-0'>
                        <h3 className='truncate text-sm font-semibold text-[#171a21]'>{project.alias || 'Untitled project'}</h3>
                        <p className='mt-0.5 truncate text-xs text-[#687386]'>
                            {project.file_count || 0} files · {project.editors?.length || 0} editor{project.editors?.length === 1 ? '' : 's'}
                        </p>
                    </div>
                    <span className='shrink-0 text-xs text-[#687386]'>{prettyDate(project.last_updated)}</span>
                </div>
                <div className='flex shrink-0 items-center gap-1.5'>
                    <Link href={`/p/${project.alias}`} className='rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#364152] hover:bg-[#f2f5f9]'>
                        Open
                    </Link>
                    <button type='button' onClick={() => void handleDelete()} aria-label={`Delete project ${project.alias}`} className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'>
                        <Trash2 className='h-4 w-4' />
                    </button>
                </div>
            </div>
            {error && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={error} className=' min-w-full px-4 bg-light' />
            </div>}
        </div>
    )
}
