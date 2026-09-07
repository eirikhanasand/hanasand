'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatTiDate, type TiAdminSource } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../manualRunButton'

export default function SourceRow({ source: initialSource, scope }: { source: TiAdminSource, scope: string }) {
    const router = useRouter()
    const [status, setStatus] = useState(initialSource.status)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const source = { ...initialSource, status }
    const inactive = status !== 'active'

    async function toggle() {
        setBusy(true)
        setError('')
        try {
            const response = await fetch('/api/ti/scraper/control', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'source_status', sourceId: source.id, tenantId: source.tenantId, status: inactive ? 'active' : 'paused' }),
            })
            const result = await response.json()
            if (!response.ok || !result.ok) throw new Error(result.payload?.error?.message || 'Could not update this source. Please try again.')
            if (result.payload?.source?.status !== (inactive ? 'active' : 'paused')) throw new Error('The source change was not confirmed. Please refresh and try again.')
            setStatus(inactive ? 'active' : 'paused')
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not update this source. Please try again.')
        } finally { setBusy(false) }
    }
    const darkweb = /dark|tor|onion/i.test(`${source.family} ${source.accessMethod} ${source.url}`)
    return <div className='grid grid-cols-[1.55fr_0.8fr_0.85fr_0.85fr_0.8fr_0.8fr_1.35fr] gap-3 border-b border-ui-border px-4 py-3 text-sm last:border-b-0 hover:bg-ui-panel'>
        <div className='min-w-0'><Link href={`/ti/sources/${source.id}?scope=${scope}`} className='font-semibold text-ui-text hover:text-ui-primary'>{source.name}</Link><p className='mt-1 truncate text-xs text-ui-muted'>{source.family.replaceAll('_', ' ')} · {source.owner}</p></div>
        <div><p className='font-semibold text-ui-text'>{darkweb ? 'Dark web' : source.accessMethod || 'Clearweb'}</p></div>
        <Status source={source} />
        <div>{source.lastUsefulAt ? <><p className='font-semibold text-ui-text'>{relative(source.lastUsefulAt)}</p><time dateTime={source.lastUsefulAt} className='mt-1 block text-xs text-ui-muted'>{formatTiDate(source.lastUsefulAt)}</time></> : <p className='text-sm text-ui-muted'>{source.productiveCycleCount > 0 ? 'Date not recorded' : 'No useful output yet'}</p>}</div>
        <div><p className='font-semibold text-ui-text' title='Collection runs that produced useful output'>{source.productiveCycleCount} {source.productiveCycleCount === 1 ? 'time' : 'times'}</p></div>
        <div><p className='font-semibold text-ui-text'>{source.customerMatchCount}</p><p className='mt-1 text-xs text-ui-muted'>customer matches</p></div>
        <div className='flex flex-wrap items-center gap-1.5'><button type='button' onClick={toggle} disabled={busy} aria-label={`${inactive ? 'Activate' : 'Deactivate'} ${source.name}`} className='inline-flex h-8 shrink-0 items-center rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text hover:bg-ui-raised disabled:cursor-wait disabled:opacity-60'>{busy ? 'Saving…' : inactive ? 'Activate' : 'Deactivate'}</button>{!inactive ? <ManualRunButton compact sourceId={source.id} label='Run' queries={source.domains} /> : null}{source.url && !darkweb ? <a href={source.url} target='_blank' rel='noopener noreferrer' className='inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Open <ExternalLink className='h-3 w-3' /></a> : <Link href='/browser' className='inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Preview</Link>}<Link href={`/ti/sources/${source.id}?scope=${scope}`} className='inline-flex h-8 shrink-0 items-center rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text hover:bg-ui-raised'>Details</Link>{error && <p role='alert' className='w-full text-xs text-ui-danger'>{error}</p>}</div>
    </div>
}

function Status({ source }: { source: TiAdminSource }) {
    const label = source.status === 'active' ? 'Active' : source.status === 'review' ? 'Review' : 'Inactive'
    return <div><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${source.status === 'active' ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-border text-ui-muted'}`}>{label}</span></div>
}

function relative(value: string) { const age = Date.now() - Date.parse(value); if (!Number.isFinite(age)) return 'not recorded'; const minutes = Math.max(0, Math.round(age / 60_000)); return minutes < 60 ? `${minutes}m ago` : minutes < 2_880 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1_440)}d ago` }
