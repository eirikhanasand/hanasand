'use client'

import { stopImpersonating } from '@/utils/impersonation/client'
import { UserRoundCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ImpersonationBanner({ id, name }: { id: string, name?: string }) {
    const router = useRouter()
    const label = name || id

    return (
        <div className='mb-2 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-text shadow-sm'>
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
                    className='rounded-lg border border-ui-warning/35 bg-ui-panel px-3 py-1.5 text-xs font-bold text-ui-warning transition hover:bg-ui-raised'
                >
                    Return to own view
                </button>
            </div>
        </div>
    )
}
