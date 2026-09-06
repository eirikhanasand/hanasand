'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Copy, Info, Minus, Plus, Redo2, Settings2, Undo2 } from 'lucide-react'
import SheetEditor from './sheetEditor'
import CodeReview from './codeReview'
import type { SheetSettings } from './workspace'
import { identifiedSheets, writeSheets, sheetChanges } from './workspace'
import type { ThesisDocument } from '@/utils/thesis'
import useThesis from './useThesis'

type HistoryItem = { revision: number, title: string, saved_at: string, immediate: boolean }

export default function ThesisClient({ initialDocument, canEdit }: { initialDocument: ThesisDocument, canEdit: boolean }) {
    const [ready, setReady] = useState(false)
    const [footerVisible, setFooterVisible] = useState(false)
    useEffect(() => {
        const footer = window.document.querySelector('footer')
        if (!footer) return
        const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting), { rootMargin: '0px 0px -1px 0px' })
        observer.observe(footer)
        return () => observer.disconnect()
    }, [])
    useEffect(() => { setReady(true) }, [])
    const thesis = useThesis(initialDocument, canEdit)
    const { document } = thesis
    const selected = useSearchParams().get('sheet')
    const [validationError, setValidationError] = useState('')
    const sheets = identifiedSheets(document.title, document.body)
    const active = Math.max(0, sheets.findIndex(sheet => sheet.id === selected))
    function selectSheet(id: string, replace = false) {
        const url = new URL(window.location.href)
        if (url.searchParams.get('sheet') === id) return
        url.searchParams.set('sheet', id)
        if (replace) window.history.replaceState(null, '', url)
        else window.history.pushState(null, '', url)
    }
    useEffect(() => {
        // History updates can lag behind document edits; do not replace a newer selection.
        if (ready && selected && selected === new URL(window.location.href).searchParams.get('sheet') && !sheets.some(sheet => sheet.id === selected)) selectSheet(sheets[0].id, true)
    }, [ready, selected, document.body])
    const settings = sheets[active].settings || {}
    const codeEnabled = settings.codeReview ?? sheets[active].name.toLowerCase() === 'code'
    function updateSettings(key: keyof SheetSettings, value: boolean) {
        if (!canEdit) return
        const next = sheets.map((sheet, index) => index === active ? { ...sheet, settings: { ...sheet.settings, [key]: value } } : sheet)
        const body = writeSheets(next)
        if (body.length > 1_000_000) { setValidationError('The workspace is full.'); return }
        thesis.update('body', body)
        if (key === 'history' && !value) setHistory(null)
    }
    function updateSheet(field: 'title' | 'body', value: string, group?: string) {
        const next = sheets.map((sheet, index) => index === active ? { ...sheet, [field]: value } : sheet)
        if (field === 'title' && (!value.trim() || value.length > 500)) { setValidationError('Enter a title of 1–500 characters.'); return }
        const body = writeSheets(next)
        if (body.length > 1_000_000) { setValidationError('The workspace is full. Shorten the content before adding more.'); return }
        setValidationError('')
        thesis.update('body', body, group ? `${sheets[active].id}:${group}` : undefined)
    }
    const [sheetDialog, setSheetDialog] = useState<{ kind: 'add' } | { kind: 'delete', id: string, name: string } | null>(null)
    const [sheetName, setSheetName] = useState('')
    const [dialogError, setDialogError] = useState('')
    const [copyMessage, setCopyMessage] = useState('')
    const dialogRef = useRef<HTMLDialogElement>(null)
    const triggerRef = useRef<HTMLButtonElement | null>(null)
    useEffect(() => {
        if (sheetDialog) dialogRef.current?.showModal()
        else if (triggerRef.current) {
            const target = triggerRef.current.isConnected ? triggerRef.current : window.document.querySelector<HTMLButtonElement>('.thesis-tabs [aria-selected=true]')
            target?.focus()
        }
    }, [sheetDialog])
    function closeSheetDialog() {
        dialogRef.current?.close()
        setSheetDialog(null)
    }
    function openSheetDialog(dialog: NonNullable<typeof sheetDialog>, trigger: HTMLButtonElement) {
        triggerRef.current = trigger
        setSheetName('')
        setDialogError('')
        setCopyMessage('')
        setSheetDialog(dialog)
    }
    const deleteTarget = sheetDialog?.kind === 'delete' ? sheets.find(sheet => sheet.id === sheetDialog.id && sheet.name === sheetDialog.name) : undefined
    function submitSheetDialog(event: React.FormEvent) {
        event.preventDefault()
        if (!canEdit || !sheetDialog) return
        if (sheetDialog.kind === 'add') {
            const name = sheetName.trim()
            if (!name || name.length > 100) { setDialogError('Enter a sheet name of 1–100 characters.'); return }
            const id = crypto.randomUUID()
            const body = writeSheets([...sheets, { id, name, title: `# ${name}`, body: '' }])
            if (body.length > 1_000_000) { setDialogError('The workspace is full.'); return }
            thesis.update('body', body)
            selectSheet(id)
        } else {
            if (!deleteTarget || sheets.length === 1 || sheetName !== deleteTarget.name) return
            const index = sheets.findIndex(sheet => sheet.id === deleteTarget.id)
            thesis.update('body', writeSheets(sheets.filter(sheet => sheet.id !== deleteTarget.id)))
            selectSheet(sheets[index > 0 ? index - 1 : 1].id, true)
        }
        setValidationError('')
        closeSheetDialog()
    }
    const [history, setHistory] = useState<HistoryItem[] | null>(null)
    const [preview, setPreview] = useState<ThesisDocument | null>(null)
    const [historyError, setHistoryError] = useState('')
    const [historyHelp, setHistoryHelp] = useState(false)
    const [busy, setBusy] = useState(false)
    const [more, setMore] = useState(false)

    async function loadHistory(older = false) {
        setBusy(true)
        setHistoryError('')
        try {
            const before = older && history?.length ? `?before=${history.at(-1)!.revision}` : ''
            const response = await fetch('/api/thesis/history' + before, { cache: 'no-store' })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'History could not be loaded.')
            setHistory(older ? [...(history || []), ...result] : result)
            setMore(result.length === 50)
        } catch (error) {
            setHistoryError(error instanceof Error ? error.message : 'History could not be loaded.')
        } finally { setBusy(false) }
    }

    async function readVersion(revision: number): Promise<ThesisDocument> {
        if (preview?.revision === revision) return preview
        const response = await fetch(`/api/thesis/history?revision=${revision}`, { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'This version could not be loaded.')
        return result
    }

    async function showVersion(revision: number) {
        if (preview?.revision === revision) { setPreview(null); return }
        setBusy(true)
        setHistoryError('')
        try {
            setPreview(await readVersion(revision))
        } catch (error) {
            setHistoryError(error instanceof Error ? error.message : 'This version could not be loaded.')
        } finally { setBusy(false) }
    }

    async function restore(revision: number) {
        setBusy(true)
        setHistoryError('')
        try {
            if (await thesis.restore(await readVersion(revision))) { setPreview(null); await loadHistory() }
        } catch (error) {
            setHistoryError(error instanceof Error ? error.message : 'This version could not be restored.')
        } finally { setBusy(false) }
    }

    return (
        <section className='mx-auto grid w-full max-w-6xl gap-6 px-4 pt-12 pb-32 text-ui-text md:px-8 md:pt-16' aria-label='Thesis document'
            onKeyDownCapture={event => {
                if (!canEdit || event.nativeEvent.isComposing || (event.target as HTMLElement).closest('dialog, .code-workspace')) return
                if (!(event.metaKey || event.ctrlKey) || event.altKey) return
                const key = event.key.toLowerCase()
                if (key !== 'z' && key !== 'y') return
                event.preventDefault(); event.stopPropagation()
                if (busy) return
                if (key === 'y' || event.shiftKey) thesis.redo()
                else thesis.undo()
            }}
            onMouseDownCapture={event => {
                // Keep the active line stable until a document control has received its click. Keyboard focus still behaves normally.
                if (!(event.target as HTMLElement).closest('dialog, .code-workspace') && (event.target as HTMLElement).closest('button, [role=button], .thesis-settings > summary')) event.preventDefault()
            }}>
            <div role='tabpanel' id={`sheet-${active}`} aria-labelledby={`tab-${active}`}>
                <SheetEditor key={sheets[active].id} sheet={sheets[active]} canEdit={canEdit && ready} onChange={updateSheet} showInsertTable={settings.insertTable !== false}
                    trailingActions={canEdit && <details className='thesis-settings' key={sheets[active].id} onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.open = false }}>
                        <summary aria-label='Sheet settings' title='Sheet settings'><Settings2 size={17} /></summary>
                        <div className='thesis-settings-panel' role='group' aria-label='Features on this sheet'>
                            <strong>Features on this sheet</strong>
                            <label><input type='checkbox' checked={settings.insertTable !== false} onChange={event => updateSettings('insertTable', event.target.checked)} />Insert table</label>
                            <label><input type='checkbox' checked={settings.history !== false} onChange={event => updateSettings('history', event.target.checked)} />History</label>
                            <label><input type='checkbox' checked={codeEnabled} onChange={event => updateSettings('codeReview', event.target.checked)} />Code review (owner only)</label>
                        </div>
                    </details>}
                    actions={canEdit && <>
                        <button type='button' disabled={!thesis.canUndo || busy} onClick={thesis.undo} aria-label='Undo' title='Undo (Ctrl/⌘ Z)' className='grid min-h-11 min-w-11 place-items-center rounded-lg border border-ui-border hover:bg-ui-raised disabled:opacity-40'><Undo2 size={18} /></button>
                        <button type='button' disabled={!thesis.canRedo || busy} onClick={thesis.redo} aria-label='Redo' title='Redo (Ctrl/⌘ Shift Z)' className='grid min-h-11 min-w-11 place-items-center rounded-lg border border-ui-border hover:bg-ui-raised disabled:opacity-40'><Redo2 size={18} /></button>
                        {settings.history !== false && <button type='button' disabled={busy || !ready} aria-expanded={history !== null} onClick={() => history === null ? loadHistory() : setHistory(null)} className='min-h-11 rounded-lg border border-ui-border px-3 py-2 text-sm hover:bg-ui-raised disabled:opacity-40'>
                            {history === null ? 'History' : 'Close history'}
                        </button>}
                    </>} />
                {canEdit && ready && codeEnabled && <CodeReview />}
            </div>
            {validationError && <p role='alert' className='text-sm text-ui-danger'>{validationError}</p>}
            <nav className='thesis-tabs' hidden={footerVisible} aria-label='Sheet navigation'>
                <div role='tablist' aria-label='Thesis sheets' className='flex'>
                    {sheets.map(({ id, name }, index) => <div key={id} role='presentation' className='thesis-tab' data-active={active === index}><button id={`tab-${index}`} role='tab' disabled={!ready} aria-selected={active === index} aria-controls={`sheet-${index}`} tabIndex={active === index ? 0 : -1}
                        onClick={() => selectSheet(id)} onKeyDown={event => {
                            const target = event.key === 'ArrowRight' ? (index + 1) % sheets.length : event.key === 'ArrowLeft' ? (index + sheets.length - 1) % sheets.length : event.key === 'Home' ? 0 : event.key === 'End' ? sheets.length - 1 : -1
                            if (target >= 0) { event.preventDefault(); selectSheet(sheets[target].id); window.document.getElementById(`tab-${target}`)?.focus() }
                        }}>{name}</button>
                    {canEdit && active === index && <button className='thesis-tab-remove' disabled={!ready || sheets.length === 1} aria-label={`Remove ${name} sheet`} title={sheets.length === 1 ? 'Keep at least one sheet' : `Remove ${name}`} onClick={event => openSheetDialog({ kind: 'delete', id, name }, event.currentTarget)}><Minus size={16} aria-hidden='true' /></button>}
                    </div>)}
                </div>
                {canEdit && <button disabled={!ready} onClick={event => openSheetDialog({ kind: 'add' }, event.currentTarget)} aria-label='Add sheet'><Plus size={18} aria-hidden='true' /></button>}
            </nav>
            {canEdit && sheetDialog && <dialog ref={dialogRef} className='thesis-sheet-dialog' aria-labelledby='sheet-dialog-title' onCancel={event => { event.preventDefault(); closeSheetDialog() }}>
                <form onSubmit={submitSheetDialog} className='grid gap-5'>
                    <h2 id='sheet-dialog-title' className='text-lg font-semibold'>{sheetDialog.kind === 'add' ? 'Create a new sheet' : 'Are you sure you want to delete?'}</h2>
                    {sheetDialog.kind === 'delete' && <div className='text-sm leading-6 text-ui-muted'>
                        <p>This deletes the sheet and its content. Earlier saved versions remain in shared History.</p>
                        <div id='sheet-name-instruction' className='mt-3'>Enter “<span className='font-semibold text-ui-text'>{sheetDialog.name}</span>” <button type='button' className='inline-flex rounded-md p-2 align-middle text-ui-text hover:bg-ui-raised' aria-label='Copy sheet name' onClick={async() => {
                            try { await navigator.clipboard.writeText(sheetDialog.name); setCopyMessage('Sheet name copied.') }
                            catch { setCopyMessage('Could not copy. Select the sheet name above and copy it manually.') }
                        }}><Copy size={16} aria-hidden='true' /></button> below to confirm.</div>
                        <p role='status'>{copyMessage}</p>
                    </div>}
                    <label className='grid gap-2 text-sm font-medium'>
                        {sheetDialog.kind === 'add' ? 'Sheet name' : 'Confirm sheet name'}
                        <input autoFocus value={sheetName} onChange={event => setSheetName(event.target.value)} maxLength={sheetDialog.kind === 'add' ? 100 : undefined} autoComplete='off' aria-describedby={sheetDialog.kind === 'delete' ? 'sheet-name-instruction' : undefined} className='w-full rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-ui-text outline-none focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15' />
                    </label>
                    {sheetDialog.kind === 'delete' && (!deleteTarget || sheets.length === 1) && <p role='alert' className='text-sm text-ui-danger'>This sheet can no longer be deleted. Close this dialog and check the current sheets.</p>}
                    {dialogError && <p role='alert' className='text-sm text-ui-danger'>{dialogError}</p>}
                    <div className='flex justify-between gap-3 pt-2'>
                        <button type='button' onClick={closeSheetDialog} className='rounded-md border border-ui-border bg-ui-raised px-4 py-2 text-sm font-semibold text-ui-muted hover:text-ui-text'>Cancel</button>
                        <button type='submit' disabled={sheetDialog.kind === 'add' ? !sheetName.trim() : !deleteTarget || sheets.length === 1 || sheetName !== sheetDialog.name} className={`rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${sheetDialog.kind === 'delete' ? 'bg-ui-danger text-white' : 'bg-ui-primary text-ui-canvas'}`}>{sheetDialog.kind === 'add' ? 'Create sheet' : 'Delete'}</button>
                    </div>
                </form>
            </dialog>}
            {canEdit ? (
                <>
                    {thesis.error && <p role='alert' className='text-sm text-ui-danger'>{thesis.error}</p>}
                    {thesis.conflict && (
                        <div className='flex flex-wrap gap-3'>
                            <button type='button' onClick={() => thesis.resolve(true)} className='rounded-lg border border-ui-border px-3 py-2'>Use my draft</button>
                            <button type='button' onClick={() => thesis.resolve(false)} className='rounded-lg border border-ui-border px-3 py-2'>Use latest version</button>
                        </div>
                    )}
                    {thesis.recoveries.map(item => (
                        <button key={item.key} type='button' onClick={() => thesis.recover(item)} className='rounded-lg border border-ui-border px-3 py-2 text-left'>
                            Recover browser draft: {item.title} — {new Date(item.savedAt).toLocaleString()}
                        </button>
                    ))}
                    {settings.history !== false && history !== null && (
                        <section aria-label='Version history' className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-4'>
                            <div className='flex items-center justify-between gap-3'>
                                <h2 className='font-semibold'>Previous version</h2>
                                <button type='button' aria-label='About version history' aria-expanded={historyHelp} aria-controls='thesis-history-help' onClick={() => setHistoryHelp(!historyHelp)} className='grid min-h-11 min-w-11 place-items-center rounded-lg text-ui-muted hover:bg-ui-raised'><Info size={18} /></button>
                            </div>
                            {historyHelp && <div id='thesis-history-help' className='rounded-lg border border-ui-border bg-ui-raised p-3 text-sm leading-6 text-ui-muted'>A checkpoint is saved every 20 minutes for 7 days. After that, up to 3 checkpoints are kept per day.</div>}
                            {history.length === 0 && <p>No earlier versions yet.</p>}
                            <ul className='grid gap-2'>
                                {history.map(item => (
                                    <li key={item.revision} className='group rounded-lg border border-ui-border'>
                                        <div className='flex items-center gap-2 px-3 py-2'>
                                            <button type='button' disabled={busy} aria-expanded={preview?.revision === item.revision} aria-controls={`thesis-version-${item.revision}`} onClick={() => showVersion(item.revision)} className='min-w-0 flex-1 rounded-sm py-1 text-left focus-visible:outline-2 focus-visible:outline-ui-primary'>
                                                {item.immediate ? 'Previous version' : item.title} — {new Date(item.saved_at).toLocaleString()}
                                            </button>
                                            <button type='button' aria-label={`Restore version ${item.revision}`} disabled={busy || thesis.conflict} onClick={() => restore(item.revision)} className='shrink-0 rounded-md px-2 py-1 text-sm text-ui-muted transition-opacity hover:bg-ui-raised hover:text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100'>
                                                Restore
                                            </button>
                                        </div>
                                        {preview?.revision === item.revision && (
                                            <section id={`thesis-version-${item.revision}`} aria-label='Version preview' className='grid gap-3 border-t border-ui-border p-3'>
                                                <p className='text-sm text-ui-muted'>Changes from this saved version to the current workspace. Restore restores all sheets together.</p>
                                                {sheetChanges(identifiedSheets(preview.title, preview.body), sheets).length === 0 && <p>No sheet changes.</p>}
                                                {sheetChanges(identifiedSheets(preview.title, preview.body), sheets).map(({ before, after }) => <section key={(before || after)!.id} className='grid gap-3'>
                                                    <h3 className='font-semibold'>{(after || before)!.name} — {!before ? 'Added' : !after ? 'Removed' : 'Changed'}</h3>
                                                    <div className='grid gap-4 md:grid-cols-2'>
                                                        <div><h4>Saved version</h4>{before ? <SheetEditor sheet={before} canEdit={false} onChange={() => {}} /> : <p>Sheet did not exist.</p>}</div>
                                                        <div><h4>Current workspace</h4>{after ? <SheetEditor sheet={after} canEdit={false} onChange={() => {}} /> : <p>Sheet removed.</p>}</div>
                                                    </div>
                                                </section>)}
                                            </section>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {more && <button type='button' disabled={busy} onClick={() => loadHistory(true)}>Older versions</button>}
                        </section>
                    )}
                    {historyError && <p role='alert' className='text-sm text-ui-danger'>{historyError}</p>}
                </>
            ) : null}
        </section>
    )
}
