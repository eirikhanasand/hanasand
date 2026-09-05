'use client'

import { useEffect, useState } from 'react'
import SheetEditor from './sheetEditor'
import { readSheets, writeSheets, sheetNames } from './workspace'
import type { ThesisDocument } from '@/utils/thesis'
import useThesis from './useThesis'

type HistoryItem = { revision: number, title: string, saved_at: string, immediate: boolean }

export default function ThesisClient({ initialDocument, canEdit }: { initialDocument: ThesisDocument, canEdit: boolean }) {
    const [ready, setReady] = useState(false)
    useEffect(() => { setReady(true) }, [])
    const thesis = useThesis(initialDocument, canEdit)
    const { document } = thesis
    const [active, setActive] = useState(0)
    const [validationError, setValidationError] = useState('')
    const sheets = readSheets(document.title, document.body)
    function updateSheet(field: 'title' | 'body', value: string) {
        const next = sheets.map((sheet, index) => index === active ? { ...sheet, [field]: value } : sheet)
        if (field === 'title' && (!value.trim() || value.length > 500)) { setValidationError('Enter a title of 1–500 characters.'); return }
        const body = writeSheets(next)
        if (body.length > 1_000_000) { setValidationError('The workspace is full. Shorten the content before adding more.'); return }
        setValidationError('')
        if (active === 0 && field === 'title') thesis.update('title', value)
        else thesis.update('body', body)
    }
    const [history, setHistory] = useState<HistoryItem[] | null>(null)
    const [preview, setPreview] = useState<ThesisDocument | null>(null)
    const [historyError, setHistoryError] = useState('')
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
        <section className='mx-auto grid w-full max-w-6xl gap-6 px-4 pt-12 pb-32 text-ui-text md:px-8 md:pt-16' aria-label='Thesis document'>
            <div role='tabpanel' id={`sheet-${active}`} aria-labelledby={`tab-${active}`}>
                <SheetEditor key={active} sheet={sheets[active]} canEdit={canEdit && ready} onChange={updateSheet} />
            </div>
            {validationError && <p role='alert' className='text-sm text-ui-danger'>{validationError}</p>}
            <nav className='thesis-tabs' role='tablist' aria-label='Thesis sheets'>
                {sheetNames.map((name, index) => <button key={name} id={`tab-${index}`} role='tab' disabled={!ready} aria-selected={active === index} aria-controls={`sheet-${index}`} tabIndex={active === index ? 0 : -1}
                    onClick={() => setActive(index)} onKeyDown={event => {
                        const target = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : -1
                        if (target >= 0) { event.preventDefault(); setActive(target); window.document.getElementById(`tab-${target}`)?.focus() }
                    }}>{name}</button>)}
            </nav>
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
                    <div>
                        <button type='button' disabled={busy} onClick={() => history === null ? loadHistory() : setHistory(null)} className='rounded-lg border border-ui-border px-3 py-2'>
                            {history === null ? 'History' : 'Close history'}
                        </button>
                    </div>
                    {history !== null && (
                        <section aria-label='Version history' className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-4'>
                            <p className='text-sm text-ui-muted'>Previous version, plus checkpoints every 20 minutes for seven days; up to three per day after that.</p>
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
                                                {readSheets(preview.title, preview.body).map((sheet, index) => <section key={index}><h3>{sheetNames[index]}</h3><SheetEditor sheet={sheet} canEdit={false} onChange={() => {}} /></section>)}
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
