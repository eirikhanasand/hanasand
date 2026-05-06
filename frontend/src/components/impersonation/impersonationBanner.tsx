'use client'

import { stopImpersonating } from '@/utils/impersonation/client'
import { UserRoundCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ImpersonationBanner({ id, name }: { id: string, name?: string }) {
    const router = useRouter()
    const label = name || id

    return (
        <div className='mb-2 rounded-xl border border-amber-200/18 bg-amber-300/10 px-3 py-2 text-sm text-amber-50 shadow-[0_10px_30px_rgba(0,0,0,0.18)]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='flex min-w-0 items-center gap-2 font-semibold'>
                    <UserRoundCheck className='h-4 w-4 shrink-0' />
                    <span className='truncate'>Impersonating {label}</span>
                </div>
                <button
                    type='button'
                    onClick={() => {
                        stopImpersonating()
                        router.refresh()
                    }}
                    className='rounded-lg border border-amber-100/20 bg-black/16 px-3 py-1.5 text-xs font-bold text-amber-50 transition hover:bg-black/28'
                >
                    Return to own view
                </button>
            </div>
        </div>
    )
}
