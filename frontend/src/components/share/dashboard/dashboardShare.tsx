'use client'

import Link from 'next/link'
import { deleteShare } from '@/utils/share/delete'
import { getCookie } from '@/utils/cookies/cookies'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import Notify from '../../notify/notify'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'

export default function DashboardShare({ share }: { share: Share }) {
    const [deleted, setDeleted] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const router = useRouter()

    async function handleDelete() {
        const token = getCookie('access_token')
        const userId = getCookie('id')
        const deleted = await deleteShare(share.id, token, userId)
        if (deleted) {
            setDeleted(true)
            router.refresh()
        } else {
            setError(`Unable to delete share ${share.id}.`)
        }
    }

    if (deleted) return null

    return (
        <div className='group'>
            <div className='flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-[#e0e5ed] hover:bg-[#fbfcfe]'>
                <div className='min-w-0'>
                    <h3 key={share.id} className='truncate text-sm font-semibold text-[#171a21]'>{share.alias || share.path || share.id}</h3>
                    <p className='mt-0.5 truncate text-xs text-[#687386]'>
                        {share.locked ? 'Locked' : 'Open'} · {share.wordCount || 0} words · {share.path || share.id}
                    </p>
                </div>
                <div className='flex shrink-0 items-center gap-1.5'>
                    <Link href={`/s/${share.id}`} className='rounded-lg border border-[#d8dee9] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#364152] hover:bg-[#f2f5f9]'>
                        Open
                    </Link>
                    <button type='button' onClick={() => void handleDelete()} aria-label={`Delete share ${share.alias || share.path || share.id}`} className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'>
                        <Trash2 className='h-4 w-4' />
                    </button>
                </div>
            </div>
            {error && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={error} className='min-w-full px-4 bg-light' />
            </div>}
        </div>
    )
}
