'use client'

import { useState } from 'react'
import { Plus, X, Pencil } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import getBlocklist from '@/utils/traffic/getBlocklist'
import postBlocklist from '@/utils/traffic/postBlocklist'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { AppConfirmDialog } from '@/components/ui/appDialog'

export default function BlocklistClient({ initialBlocklist }: { initialBlocklist: BlocklistEntry[] }) {
    const [blocklist, setBlocklist] = useState<BlocklistEntry[]>(Array.isArray(initialBlocklist) ? initialBlocklist : [])
    const [showBlockModal, setShowBlockModal] = useState(false)
    const [editingBlock, setEditingBlock] = useState<BlocklistEntry | null>(null)
    const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null)
    const [form, setForm] = useState<Partial<BlocklistEntry>>({})
    const { condition: message, setCondition: setMessage } = useClearStateAfter()

    function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const target = event.target
        const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value
        setForm(previous => ({ ...previous, [target.name]: value }))
    }

    async function handleBlockSubmit(event: React.SyntheticEvent) {
        event.preventDefault()
        try {
            const result = await postBlocklist(editingBlock, form)
            if (result && typeof result === 'object' && 'error' in result) {
                throw new Error(String(result.error))
            }

            setMessage(editingBlock ? 'Blocklist updated' : 'Blocklist entry added')
            setShowBlockModal(false)
            setEditingBlock(null)
            setForm({})
            setBlocklist(await getBlocklist())
        } catch (error) {
            console.error(error)
            setMessage('Failed to save blocklist entry')
        }
    }

    async function handleDeleteBlock(id: number) {
        setDeletingBlockId(null)
        try {
            const response = await fetch(`${config.url.cdn}/blocklist/${id}`, { method: 'DELETE' })
            if (!response.ok) throw new Error(`Blocklist delete returned ${response.status}`)
            setMessage('Blocklist entry deleted')
            setBlocklist(await getBlocklist())
        } catch (error) {
            console.error(error)
            setMessage('Failed to delete entry')
        }
    }

    function editBlock(entry: BlocklistEntry) {
        setEditingBlock(entry)
        setForm(entry)
        setShowBlockModal(true)
    }

    function openCreateDialog() {
        setEditingBlock(null)
        setForm({})
        setShowBlockModal(true)
    }

    return (
        <div className='grid min-w-0 gap-4'>
            <ErrorNotice compact variant='info' message={message as string | null} />
            <AppConfirmDialog
                open={deletingBlockId !== null}
                title='Delete blocklist entry?'
                body='This entry will be removed from production traffic controls.'
                confirmLabel='Delete'
                tone='danger'
                onCancel={() => setDeletingBlockId(null)}
                onConfirm={() => deletingBlockId !== null ? void handleDeleteBlock(deletingBlockId) : undefined}
            />

            <section className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                <div className='flex items-center justify-between gap-3 border-b border-ui-border p-4'>
                    <div>
                        <h1 className='text-lg font-semibold text-ui-text'>Blocklist</h1>
                        <p className='mt-1 text-sm text-ui-muted'>{blocklist.length} entries</p>
                    </div>
                    <button type='button' onClick={openCreateDialog} className='inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary hover:opacity-90'>
                        <Plus className='h-4 w-4' /> Add rule
                    </button>
                </div>
                <div className='overflow-x-auto p-4'>
                    <table className='w-full min-w-[32rem] text-left text-sm'>
                        <thead>
                            <tr className='border-b border-ui-border text-xs font-semibold text-ui-muted'>
                                <th className='py-2 pr-3'>Type</th>
                                <th className='py-2 pr-3'>Value</th>
                                <th className='py-2 pr-3'>Signals</th>
                                <th className='py-2 text-right'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {blocklist.map(entry => (
                                <tr key={entry.id} className='border-b border-ui-border text-ui-muted'>
                                    <td className='py-3 pr-3'>{entry.type === 'user_agent' ? 'User agent' : 'IP address'}</td>
                                    <td className='break-all py-3 pr-3 text-ui-text'>{entry.value}</td>
                                    <td className='py-3 pr-3'>{[entry.is_vpn && 'VPN', entry.is_proxy && 'Proxy', entry.is_tor && 'Tor'].filter(Boolean).join(' · ') || '—'}</td>
                                    <td className='py-2 text-right'>
                                        <div className='inline-flex items-center gap-1'>
                                            <button type='button' onClick={() => editBlock(entry)} aria-label={`Edit ${entry.type} ${entry.value}`} className='grid h-8 w-8 place-items-center rounded text-ui-muted hover:bg-ui-raised hover:text-ui-primary'>
                                                <Pencil className='h-4 w-4' />
                                            </button>
                                            <button type='button' onClick={() => setDeletingBlockId(entry.id)} aria-label={`Delete ${entry.type} ${entry.value}`} className='grid h-8 w-8 place-items-center rounded text-ui-muted hover:bg-ui-raised hover:text-ui-danger'>
                                                <X className='h-4 w-4' />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!blocklist.length && <tr><td colSpan={4} className='py-5 text-sm text-ui-muted'>No blocklist entries. Add an IP address or user agent to block.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>

            {showBlockModal && (
                <div onClick={event => { if (event.target === event.currentTarget) setShowBlockModal(false) }} className='fixed inset-0 z-30 grid place-items-center bg-ui-canvas/80 p-4 backdrop-blur-sm'>
                    <div role='dialog' aria-modal='true' aria-labelledby='blocklist-dialog-title' className='w-full max-w-md rounded-md border border-ui-border bg-ui-panel p-5 shadow-lg'>
                        <div className='mb-4 flex items-center justify-between gap-3'>
                            <h2 id='blocklist-dialog-title' className='text-base font-semibold text-ui-text'>{editingBlock ? 'Edit blocklist entry' : 'Add blocklist entry'}</h2>
                            <button type='button' onClick={() => setShowBlockModal(false)} aria-label='Close blocklist form' className='grid h-7 w-7 place-items-center rounded-md text-ui-muted hover:bg-ui-raised'><X className='h-4 w-4' /></button>
                        </div>
                        <form className='flex flex-col gap-3' onSubmit={handleBlockSubmit}>
                            <label className='flex flex-col gap-1.5 text-sm font-medium text-ui-muted'>
                                Type
                                <select name='type' value={form.type || ''} onChange={handleChange} required className='rounded-md border border-ui-border bg-ui-raised p-2 text-ui-text outline-none focus:border-ui-primary'>
                                    <option value=''>Select type</option>
                                    <option value='ip'>IP address</option>
                                    <option value='user_agent'>User agent</option>
                                </select>
                            </label>
                            <label className='flex flex-col gap-1.5 text-sm font-medium text-ui-muted'>
                                Value
                                <input name='value' value={form.value || ''} onChange={handleChange} required className='rounded-md border border-ui-border bg-ui-raised p-2 text-ui-text outline-none focus:border-ui-primary' />
                            </label>
                            <label className='flex items-center gap-2 text-sm text-ui-muted'>
                                <input type='checkbox' name='is_vpn' checked={Boolean(form.is_vpn)} onChange={handleChange} /> VPN
                            </label>
                            <label className='flex items-center gap-2 text-sm text-ui-muted'>
                                <input type='checkbox' name='is_proxy' checked={Boolean(form.is_proxy)} onChange={handleChange} /> Proxy
                            </label>
                            <label className='flex items-center gap-2 text-sm text-ui-muted'>
                                <input type='checkbox' name='is_tor' checked={Boolean(form.is_tor)} onChange={handleChange} /> Tor
                            </label>
                            <button type='submit' className='mt-1 h-9 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90'>
                                {editingBlock ? 'Save changes' : 'Add to blocklist'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
