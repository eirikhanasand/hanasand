'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Shield } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import DashboardRole from './dashboardRole'

export default function RoleList({ roles, canManage, highestPriority }: { roles: Role[], canManage: boolean, highestPriority: number }) {
    const router = useRouter()
    const [items, setItems] = useState(roles)
    useEffect(() => setItems(roles), [roles])
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState<Role | 'new' | null>(null)
    const [removing, setRemoving] = useState<Role | null>(null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')

    function openForm(role: Role | 'new') {
        setForm(role)
        setRemoving(null)
        setError('')
        setName(role === 'new' ? '' : role.name)
        setDescription(role === 'new' ? '' : role.description || '')
    }

    async function save(method: 'POST' | 'PUT' | 'DELETE', roleId?: string) {
        if (pending) return
        setPending(true)
        setError('')
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        try {
            const token = getCookie('access_token')
            const id = getCookie('id')
            if (!token || !id) throw new Error('Please sign in again.')
            const response = await fetch(`${config.url.api}/role${roleId ? `/${encodeURIComponent(roleId)}` : ''}`, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, id },
                ...(method === 'DELETE' ? {} : { body: JSON.stringify({
                    name: name.trim(), description: description.trim(),
                    ...(method === 'POST' ? { id: crypto.randomUUID(), created_by: id } : {})
                }) }),
                signal: controller.signal
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) throw new Error(result?.error || 'Unable to save this change. Please try again.')
            setItems(current => method === 'DELETE'
                ? current.filter(role => role.id !== roleId)
                : method === 'POST'
                    ? [...current, result].sort((a, b) => a.priority - b.priority)
                    : current.map(role => role.id === roleId ? result : role))
            setForm(null)
            setRemoving(null)
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'The request timed out. Refresh the list before trying again.')
        } finally {
            clearTimeout(timeout)
            setPending(false)
        }
    }

    const iconClass = 'rounded p-2 text-ui-muted hover:bg-ui-raised hover:text-ui-text disabled:opacity-50'
    const inputClass = 'w-full rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text'
    return (
        <DashboardPanel className='grid h-fit min-w-0 w-full self-start gap-3 p-4'>
            <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-2'><Shield className='h-4 w-4 text-ui-muted' /><h1 className='text-base font-semibold text-ui-text'>Roles</h1></div>
                {canManage && <div className='flex items-center gap-1'>
                    <button type='button' disabled={pending} aria-label='Edit roles' aria-pressed={editing} title={editing ? 'Finish editing roles' : 'Edit roles'} onClick={() => { setEditing(!editing); setForm(null); setRemoving(null); setError('') }} className={`${iconClass} ${editing ? 'bg-ui-raised text-ui-text' : ''}`}><Pencil className='h-4 w-4' /></button>
                    <button type='button' disabled={pending} aria-label='Add role' title='Add role' onClick={() => openForm('new')} className={iconClass}><Plus className='h-4 w-4' /></button>
                </div>}
            </div>
            {form && <form aria-label={form === 'new' ? 'Add role' : 'Edit role'} className='grid gap-3 rounded-lg border border-ui-border p-3' onSubmit={event => { event.preventDefault(); void save(form === 'new' ? 'POST' : 'PUT', form === 'new' ? undefined : form.id) }}>
                <label className='grid gap-1 text-xs text-ui-muted'>Name<input autoFocus required maxLength={120} value={name} disabled={pending} onChange={event => setName(event.target.value)} className={inputClass} /></label>
                <label className='grid gap-1 text-xs text-ui-muted'>Description<textarea rows={3} maxLength={2000} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} className={inputClass} /></label>
                <div className='flex justify-end gap-2'>
                    <button type='button' disabled={pending} onClick={() => { setForm(null); setError('') }} className='rounded px-3 py-2 text-sm text-ui-muted'>Cancel</button>
                    <button type='submit' disabled={pending || !name.trim()} className='rounded bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{pending ? 'Saving…' : form === 'new' ? 'Create role' : 'Save'}</button>
                </div>
            </form>}
            {removing && <div role='alertdialog' aria-label={`Delete ${removing.name}?`} className='grid gap-2 rounded-lg border border-ui-border p-3 text-sm text-ui-text'>
                <p>Delete “{removing.name}”? This also removes it from all assigned users.</p>
                <div className='flex justify-end gap-2'>
                    <button type='button' autoFocus disabled={pending} onClick={() => { setRemoving(null); setError('') }} className='rounded px-3 py-2 text-ui-muted'>Cancel</button>
                    <button type='button' disabled={pending} onClick={() => void save('DELETE', removing.id)} className='rounded px-3 py-2 text-ui-danger'>{pending ? 'Deleting…' : 'Delete role'}</button>
                </div>
            </div>}
            {error && <ErrorNotice compact message={error} />}
            <div className='grid gap-2'>
                {items.map(role => <DashboardRole key={role.id} role={role} editable={canManage && editing && highestPriority <= role.priority} disabled={pending} onEdit={() => openForm(role)} onDelete={() => { setRemoving(role); setForm(null); setError('') }} />)}
            </div>
        </DashboardPanel>
    )
}
