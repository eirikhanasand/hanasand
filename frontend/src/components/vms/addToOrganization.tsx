'use client'

import { Building2, X } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

type Organization = { id: string; name: string; role: string; status?: string }

export default function AddToOrganization({ vm, onAdded }: { vm: VM; onAdded?: () => void | Promise<void> }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [selected, setSelected] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    if (!vm.can_assign_organization || vm.organization_id) return null
    async function show() {
        setOpen(true); setBusy(true); setError('')
        try {
            const response = await fetch('/api/organizations', { cache: 'no-store' })
            const body = await response.json()
            if (!response.ok) throw new Error(body.error || 'Unable to load organizations.')
            const available = (body.organizations || []).filter((org: Organization) => ['owner', 'admin'].includes(org.role) && (!org.status || org.status === 'active'))
            setOrganizations(available); setSelected(available[0]?.id || '')
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load organizations.') }
        finally { setBusy(false) }
    }
    async function add(event: React.FormEvent) {
        event.preventDefault(); setBusy(true); setError('')
        try {
            const response = await fetch(`${config.url.api}/vm/${encodeURIComponent(vm.name)}/organization`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', id: getCookie('id') || '', Authorization: `Bearer ${getCookie('access_token') || ''}` },
                body: JSON.stringify({ organizationId: selected }),
            })
            const body = await response.json()
            if (!response.ok) throw new Error(body.error || 'Unable to add VM.')
            setOpen(false); await onAdded?.(); router.refresh(); window.dispatchEvent(new Event('vms-updated'))
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add VM.') }
        finally { setBusy(false) }
    }
    return <div>
        <button type='button' onClick={() => open ? setOpen(false) : void show()} aria-expanded={open} title='Add to organization' aria-label={`Add ${vm.name} to organization`} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-primary hover:bg-ui-raised'><Building2 className='h-4 w-4' />Add to organization</button>
        {open && <form onSubmit={add} className='mt-2 grid max-w-sm gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 text-ui-text'>
            <div className='flex items-center justify-between gap-3'><strong className='text-sm'>Add {vm.name}</strong><button type='button' aria-label='Close organization selection' disabled={busy} onClick={() => setOpen(false)}><X className='h-4 w-4' /></button></div>
            <p className='text-xs text-ui-muted'>Organization members will get access. This replaces individual VM sharing.</p>
            <label className='grid gap-1 text-sm'>Organization<select autoFocus value={selected} onChange={event => setSelected(event.target.value)} disabled={busy} className='h-9 rounded-md border border-ui-border bg-ui-raised px-3'>
                {!organizations.length && <option value=''>{busy ? 'Loading organizations…' : 'No organizations available'}</option>}
                {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select></label>
            {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
            <button disabled={busy || !selected} className='h-9 rounded-md bg-ui-primary px-4 font-semibold text-ui-canvas disabled:opacity-50'>{busy ? 'Please wait…' : 'Add VM'}</button>
        </form>}
    </div>
}
