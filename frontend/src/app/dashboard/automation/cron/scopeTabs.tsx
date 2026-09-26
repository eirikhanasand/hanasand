'use client'

import { useRouter } from 'next/navigation'

export default function CronScopeTabs({ system, personalCount, systemCount, canManageSystem }: {
    system: boolean
    personalCount: number
    systemCount?: number
    canManageSystem: boolean
}) {
    const router = useRouter()
    return <nav aria-label='Cron job scope' className='flex gap-2'>
        <button type='button' aria-pressed={!system} onClick={() => router.push('/automation/cron')} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${!system ? 'border-ui-primary bg-ui-primary text-white' : 'border-ui-border bg-ui-panel text-ui-muted hover:text-ui-text'}`}>Personal <span className='ml-1 opacity-80'>({personalCount})</span></button>
        {canManageSystem && <button type='button' aria-pressed={system} onClick={() => router.push('/automation/cron?scope=system')} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${system ? 'border-ui-primary bg-ui-primary text-white' : 'border-ui-border bg-ui-panel text-ui-muted hover:text-ui-text'}`}>System <span className='ml-1 opacity-80'>({systemCount ?? '…'})</span></button>}
    </nav>
}
