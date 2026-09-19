'use client'

import { useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { RoleIcon, roleIconId, roleIcons } from './roleIcons'

export default function RoleIconPicker({ value, role, onChange, disabled }: { value: string | null, role: { id?: string, name: string }, onChange: (icon: string | null) => void, disabled: boolean }) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('All icons')
    const trigger = useRef<HTMLButtonElement>(null)
    const selected = roleIconId({ ...role, icon: value })
    const presets = roleIcons.filter(preset => (category === 'All icons' || preset.category === category) && `${preset.label} ${preset.category}`.toLowerCase().includes(search.trim().toLowerCase()))
    function close() { setOpen(false); trigger.current?.focus() }
    return <div className='grid min-w-0 gap-2 sm:col-span-2'>
        <span className='text-xs text-ui-muted'>Role icon</span>
        <button ref={trigger} type='button' disabled={disabled} aria-label='Choose role icon' aria-expanded={open} aria-controls='role-icon-catalog' onClick={() => setOpen(!open)} className='flex min-h-11 w-full items-center gap-3 rounded-lg border border-ui-primary/25 bg-ui-primary/10 px-3 py-2 text-left text-sm text-ui-text disabled:opacity-50'>
            <span className='text-ui-primary'><RoleIcon role={{ ...role, icon: value }} /></span>
            <span className='min-w-0 flex-1'>{roleIcons.find(preset => preset.id === selected)?.label}<span className='ml-2 text-xs text-ui-muted'>{value ? '' : 'Automatic'}</span></span>
            <ChevronDown className='h-4 w-4 shrink-0' aria-hidden='true' />
        </button>
        {open && <section id='role-icon-catalog' aria-label='Icon catalog' className='grid min-w-0 gap-3 rounded-xl border border-ui-primary/25 bg-ui-canvas p-3' onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }}>
            <div className='grid gap-2 sm:grid-cols-2'>
                <label className='grid gap-1 text-xs text-ui-muted'>Search icons<input aria-label='Search icons' autoFocus type='search' value={search} onChange={event => setSearch(event.target.value)} placeholder='Search icons…' className='min-h-11 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text' /></label>
                <label className='grid gap-1 text-xs text-ui-muted'>Category<select aria-label='Category' value={category} onChange={event => setCategory(event.target.value)} className='min-h-11 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text'>{['All icons', ...new Set(roleIcons.map(preset => preset.category))].map(name => <option key={name}>{name}</option>)}</select></label>
            </div>
            <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-ui-muted'><span role='status'>{presets.length} icons</span><button type='button' disabled={disabled} className='min-h-11 px-2 text-ui-primary' onClick={() => { onChange(null); close() }}>Use automatic icon</button></div>
            <div className='grid max-h-72 grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-1 min-[420px]:grid-cols-3 sm:grid-cols-6 lg:grid-cols-8'>
                {presets.map(({ id, label, Icon }) => <button key={id} type='button' disabled={disabled} aria-label={`${label} icon`} aria-pressed={selected === id} title={label} onClick={() => { onChange(id); close() }} className={`relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary ${selected === id ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text hover:border-ui-primary/50'} disabled:opacity-50`}>
                    <Icon className='h-5 w-5 shrink-0' aria-hidden='true' /><span className='w-full wrap-break-word text-[11px] leading-tight'>{label}</span>{selected === id && <Check className='absolute right-1 top-1 h-3 w-3' aria-hidden='true' />}
                </button>)}
            </div>
            {!presets.length && <p className='py-4 text-center text-sm text-ui-muted'>No icons match your search.</p>}
            <button type='button' onClick={close} className='min-h-11 justify-self-end px-3 text-sm text-ui-primary'>Done</button>
        </section>}
    </div>
}
