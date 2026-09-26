'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Pencil, Plus, Search, Shield, Trash2 } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { isReservedPlaceholder } from '@/utils/users/isReservedPlaceholder'
import assignRole from '@/utils/roles/assignRole'
import unassignRole from '@/utils/roles/unassignRole'
import RoleIconPicker from './roleIconPicker'
import { RoleIcon } from './roleIcons'

export default function RoleList({ roles, users, canManage, highestPriority }: { roles: Role[], users: UserWithRole[], canManage: boolean, highestPriority: number }) {
    const router = useRouter()
    const [items, setItems] = useState(() => [...roles].sort((a, b) => a.priority - b.priority))
    const [memberships, setMemberships] = useState(() => new Map(users.map(user => [user.id, new Set(user.role_ids || [])])))
    useEffect(() => {
        setItems([...roles].sort((a, b) => a.priority - b.priority))
        setMemberships(new Map(users.map(user => [user.id, new Set(user.role_ids || [])])))
    }, [roles, users])
    const [editing, setEditing] = useState(false)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [showReserved, setShowReserved] = useState(false)
    const [form, setForm] = useState<Role | 'new' | null>(null)
    const [removing, setRemoving] = useState<Role | null>(null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [priority, setPriority] = useState('1000')
    const [icon, setIcon] = useState<string | null>(null)
    const [notice, setNotice] = useState('')
    const [pending, setPending] = useState(false)
    const [changingMember, setChangingMember] = useState<string | null>(null)
    const [error, setError] = useState('')

    function openForm(role: Role | 'new') {
        setNotice('')
        setForm(role)
        setRemoving(null)
        setError('')
        setName(role === 'new' ? '' : role.name)
        setDescription(role === 'new' ? '' : role.description || '')
        setPriority(String(role === 'new' ? Math.max(1000, highestPriority) : role.priority))
        setIcon(role === 'new' ? null : role.icon || null)
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
                    name: name.trim(), description: description.trim(), priority: Number(priority), icon,
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
                    : current.map(role => role.id === roleId ? result : role).sort((a, b) => a.priority - b.priority))
            setForm(null)
            setRemoving(null)
            setNotice(method === 'DELETE' ? 'Role deleted.' : method === 'POST' ? 'Role created.' : 'Role saved.')
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'The request timed out. Refresh the list before trying again.')
        } finally {
            clearTimeout(timeout)
            setPending(false)
        }
    }

    async function changeMembership(role: Role, user: UserWithRole) {
        if (changingMember || pending) return
        const currentRoles = memberships.get(user.id) || new Set<string>()
        const removingRole = currentRoles.has(role.id)
        setChangingMember(`${user.id}:${role.id}`)
        setError('')
        const id = getCookie('id')
        const token = getCookie('access_token')
        if (!id || !token) {
            setError('Please sign in again.')
            setChangingMember(null)
            return
        }
        try {
            const result = removingRole
                ? await unassignRole({ id, token, role: role.id, target: user.id })
                : await assignRole({ id, token, role: role.id, target: user.id })
            if (!result.status) throw new Error('Unable to update this user’s role. Please try again.')
            setMemberships(current => {
                const next = new Map(current)
                const nextRoles = new Set(next.get(user.id) || [])
                if (removingRole) nextRoles.delete(role.id)
                else nextRoles.add(role.id)
                next.set(user.id, nextRoles)
                return next
            })
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to update this user’s role. Please try again.')
        } finally {
            setChangingMember(null)
        }
    }

    const iconClass = 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded p-2 text-ui-muted hover:bg-ui-raised hover:text-ui-text disabled:opacity-50'
    const inputClass = 'min-h-11 min-w-0 w-full rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text'
    const query = search.trim().toLowerCase()
    const listedUsers = users.filter(user => showReserved || !isReservedPlaceholder(user))
    const matchingUsers = listedUsers.filter(user => !query || `${user.name} ${user.username || ''} ${user.email || ''}`.toLowerCase().includes(query))
    const visibleItems = items.filter(role => !query || role.name.toLowerCase().includes(query) || (role.description || '').toLowerCase().includes(query) || matchingUsers.length > 0)
    return (
        <DashboardPanel className='grid h-fit min-w-0 w-full self-start gap-3 p-4'>
            <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-2'><Shield className='h-4 w-4 text-ui-muted' /><h1 className='text-base font-semibold text-ui-text'>Roles</h1></div>
                {canManage && <div className='flex items-center gap-1'>
                    <button type='button' disabled={pending} aria-label='Edit roles' aria-pressed={editing} title={editing ? 'Finish editing roles' : 'Edit roles'} onClick={() => { setEditing(!editing); setForm(null); setRemoving(null); setError('') }} className={`${iconClass} ${editing ? 'bg-ui-raised text-ui-text' : ''}`}><Pencil className='h-4 w-4' /></button>
                    <button type='button' disabled={pending} aria-label='Add role' title='Add role' onClick={() => openForm('new')} className={iconClass}><Plus className='h-4 w-4' /></button>
                </div>}
            </div>
            <div className='flex items-center gap-2'>
                <label className='flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-ui-border bg-ui-canvas px-3 text-ui-muted'>
                    <Search className='h-4 w-4 shrink-0' aria-hidden='true' />
                    <input aria-label='Filter roles and users' placeholder='Filter roles or users' value={search} onChange={event => setSearch(event.target.value)} className='min-w-0 flex-1 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-muted' />
                </label>
                {users.some(isReservedPlaceholder) && <button type='button' onClick={() => setShowReserved(value => !value)} className='min-h-10 shrink-0 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-muted hover:bg-ui-panel hover:text-ui-text'>{showReserved ? 'Hide reserved' : 'Show reserved'}</button>}
            </div>
            {form && <form aria-label={form === 'new' ? 'Add role' : 'Edit role'} className='grid min-w-0 gap-4 rounded-xl border border-ui-primary/25 bg-ui-primary/5 p-3 sm:grid-cols-2 sm:p-4' onSubmit={event => { event.preventDefault(); void save(form === 'new' ? 'POST' : 'PUT', form === 'new' ? undefined : form.id) }}>
                <label className='grid gap-1 text-xs text-ui-muted'>Name<input autoFocus required maxLength={120} value={name} disabled={pending} onChange={event => setName(event.target.value)} className={inputClass} /></label>
                <label className='grid gap-1 text-xs text-ui-muted'>Priority<input aria-describedby='role-priority-help' type='number' step={1} min={form !== 'new' && form.id === 'administrator' ? 0 : Math.max(1, highestPriority)} max={2147483647} required value={priority} disabled={pending || form !== 'new' && form.id === 'administrator'} onChange={event => setPriority(event.target.value)} className={inputClass} /><span id='role-priority-help'>{form !== 'new' && form.id === 'administrator' ? 'Administrator is fixed at 0.' : 'Lower numbers have higher priority. 0 is reserved for Administrator.'}</span></label>
                <label className='grid gap-1 text-xs text-ui-muted sm:col-span-2'>Description<textarea rows={3} maxLength={2000} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} className={inputClass} /></label>
                <RoleIconPicker key={form === 'new' ? 'new' : form.id} value={icon} role={{ id: form === 'new' ? undefined : form.id, name }} onChange={setIcon} disabled={pending} />
                <div className='flex justify-end gap-2 sm:col-span-2'>
                    <button type='button' disabled={pending} onClick={() => { setForm(null); setError('') }} className='min-h-11 rounded px-3 py-2 text-sm text-ui-muted'>Cancel</button>
                    <button type='submit' disabled={pending || !name.trim()} className='min-h-11 rounded bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{pending ? 'Saving…' : form === 'new' ? 'Create role' : 'Save'}</button>
                </div>
            </form>}
            {removing && <div role='alertdialog' aria-label={`Delete ${removing.name}?`} className='grid gap-2 rounded-lg border border-ui-border p-3 text-sm text-ui-text'>
                <p>Delete “{removing.name}”? This also removes it from all assigned users.</p>
                <div className='flex justify-end gap-2'>
                    <button type='button' autoFocus disabled={pending} onClick={() => { setRemoving(null); setError('') }} className='min-h-11 rounded px-3 py-2 text-ui-muted'>Cancel</button>
                    <button type='button' disabled={pending} onClick={() => void save('DELETE', removing.id)} className='min-h-11 rounded px-3 py-2 text-ui-danger'>{pending ? 'Deleting…' : 'Delete role'}</button>
                </div>
            </div>}
            {error && <ErrorNotice compact message={error} />}
            {notice && <p role='status' className='text-sm text-ui-success'>{notice}</p>}
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[560px] border-collapse text-left'>
                    <thead><tr className='border-b border-ui-border text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ui-muted'><th className='px-3 py-2'>Group</th><th className='w-28 px-3 py-2'>Users</th><th className='w-24 px-3 py-2'>Priority</th><th className='w-24 px-3 py-2 text-right'><span className='sr-only'>Role actions</span></th></tr></thead>
                    <tbody>
                        {visibleItems.map(role => {
                            const memberUsers = users.filter(user => memberships.get(user.id)?.has(role.id))
                            const canChange = canManage && highestPriority <= role.priority
                            const isOpen = expanded === role.id
                            const roleMatchesQuery = role.name.toLowerCase().includes(query) || (role.description || '').toLowerCase().includes(query)
                            const visibleUsers = query && !roleMatchesQuery ? matchingUsers : listedUsers
                            return <Fragment key={role.id}>
                                <tr className='border-b border-ui-border/70 hover:bg-ui-raised/60'>
                                    <td className='px-3 py-2.5'>
                                        <button type='button' aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} users in ${role.name}`} onClick={() => setExpanded(isOpen ? null : role.id)} className='flex min-h-11 items-center gap-3 text-left text-ui-text'>
                                            {isOpen ? <ChevronDown className='h-4 w-4 shrink-0 text-ui-muted' /> : <ChevronRight className='h-4 w-4 shrink-0 text-ui-muted' />}
                                            <span className='grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ui-primary/20 bg-ui-primary/10 text-ui-primary'><RoleIcon role={role} /></span>
                                            <span className='min-w-0'><span className='block font-medium'>{role.name}</span>{role.description && <span className='block truncate text-xs text-ui-muted'>{role.description}</span>}</span>
                                        </button>
                                    </td>
                                    <td className='px-3 py-2.5 text-sm tabular-nums text-ui-text'>{memberUsers.length}</td>
                                    <td className='px-3 py-2.5 text-sm tabular-nums text-ui-muted'>{role.priority}</td>
                                    <td className='px-3 py-2.5 text-right'>{editing && canManage && highestPriority <= role.priority && <div className='flex justify-end gap-1'>
                                        <button type='button' disabled={pending} aria-label={`Edit ${role.name}`} title='Edit role' onClick={() => openForm(role)} className='inline-flex min-h-11 min-w-11 items-center justify-center rounded p-2 text-ui-muted hover:bg-ui-raised hover:text-ui-text disabled:opacity-50'><Pencil className='h-4 w-4' /></button>
                                        {role.id !== 'administrator' && <button type='button' disabled={pending} aria-label={`Delete ${role.name}`} title='Delete role' onClick={() => { setRemoving(role); setForm(null); setError('') }} className='inline-flex min-h-11 min-w-11 items-center justify-center rounded p-2 text-ui-muted hover:bg-ui-raised hover:text-ui-danger disabled:opacity-50'><Trash2 className='h-4 w-4' /></button>}
                                    </div>}</td>
                                </tr>
                                {isOpen && <tr className='border-b border-ui-border/70 bg-ui-raised/30'><td colSpan={4} className='px-3 py-3'>
                                    <div className='grid gap-1 sm:grid-cols-2 lg:grid-cols-3'>
                                        {visibleUsers.map(user => {
                                            const active = memberships.get(user.id)?.has(role.id) || false
                                            const key = `${user.id}:${role.id}`
                                            return <label key={user.id} className='flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-ui-text hover:bg-ui-panel'>
                                                <input type='checkbox' checked={active} disabled={!canChange || pending || changingMember !== null} onChange={() => void changeMembership(role, user)} className='h-4 w-4 accent-ui-primary disabled:opacity-50' aria-label={`${active ? 'Remove' : 'Assign'} ${role.name} ${active ? 'from' : 'to'} ${user.name}`} />
                                                <span className='min-w-0 flex-1 truncate'>{user.name}<span className='ml-2 text-xs text-ui-muted'>{user.username && user.username !== user.name ? user.username : ''}</span></span>
                                                {changingMember === key && <span className='text-xs text-ui-muted'>Saving</span>}
                                            </label>
                                        })}
                                    </div>
                                    {!visibleUsers.length && <p className='px-2 py-3 text-sm text-ui-muted'>No matching users</p>}
                                </td></tr>}
                            </Fragment>
                        })}
                        {!visibleItems.length && <tr><td colSpan={4} className='px-3 py-8 text-center text-sm text-ui-muted'>No matching roles or users</td></tr>}
                    </tbody>
                </table>
            </div>
        </DashboardPanel>
    )
}
