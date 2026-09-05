'use client'

import { useState } from 'react'
import Markdown from 'react-markdown'
import MarkdownRender from '@/components/markdown/markdown'
import type { ThesisDocument } from '@/utils/thesis'
import useThesis from './useThesis'

type HistoryItem = { revision: number, title: string, saved_at: string, immediate: boolean }

export default function ThesisClient({ initialDocument, canEdit }: { initialDocument: ThesisDocument, canEdit: boolean }) {
    const thesis = useThesis(initialDocument, canEdit)
    const { document } = thesis
    const [editingTitle, setEditingTitle] = useState(false)
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

    async function showVersion(revision: number) {
        setBusy(true)
        setHistoryError('')
        try {
            const response = await fetch(`/api/thesis/history?revision=${revision}`, { cache: 'no-store' })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'This version could not be loaded.')
            setPreview(result)
        } catch (error) {
            setHistoryError(error instanceof Error ? error.message : 'This version could not be loaded.')
        } finally { setBusy(false) }
    }

    async function restore() {
        if (!preview) return
        setBusy(true)
        if (await thesis.restore(preview)) { setPreview(null); await loadHistory() }
        setBusy(false)
    }

    const title = (
        <Markdown allowedElements={['strong', 'em', 'code', 'br']} unwrapDisallowed>
            {document.title || '# Thesis'}
        </Markdown>
    )

    return (
        <section className='mx-auto grid w-full max-w-4xl gap-6 px-4 py-12 text-ui-text md:px-8 md:py-16' aria-label='Thesis document'>
            {canEdit && editingTitle ? (
                <input
                    autoFocus
                    aria-label='Title Markdown'
                    maxLength={500}
                    className='w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-4xl font-semibold outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/35'
                    value={document.title}
                    onChange={event => thesis.update('title', event.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === 'Escape') setEditingTitle(false)
                    }}
                />
            ) : (
                <h1 className='text-4xl font-semibold leading-tight'>
                    {canEdit ? (
                        <button type='button' aria-label='Edit title' className='w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ui-primary' onClick={() => setEditingTitle(true)}>
                            {title}
                        </button>
                    ) : title}
                </h1>
            )}
            {canEdit ? (
                <>
                    <textarea
                        aria-label='Description Markdown'
                        maxLength={1_000_000}
                        className='min-h-80 w-full resize-y rounded-lg border border-ui-border bg-ui-raised p-4 font-mono text-base leading-7 outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/35'
                        value={document.body}
                        onChange={event => thesis.update('body', event.target.value)}
                    />
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
                            {history.map(item => (
                                <button key={item.revision} type='button' disabled={busy} onClick={() => showVersion(item.revision)} className='rounded-lg border border-ui-border px-3 py-2 text-left'>
                                    {item.immediate ? 'Previous version' : item.title} — {new Date(item.saved_at).toLocaleString()}
                                </button>
                            ))}
                            {more && <button type='button' disabled={busy} onClick={() => loadHistory(true)}>Older versions</button>}
                            {preview && (
                                <section aria-label='Version preview' className='grid gap-3 border-t border-ui-border pt-4'>
                                    <h2 className='font-semibold'>{preview.title}</h2>
                                    <MarkdownRender MDstr={preview.body} />
                                    <button type='button' disabled={busy || thesis.conflict} onClick={restore} className='justify-self-start rounded-lg bg-ui-primary px-4 py-2 text-ui-canvas'>Restore this version</button>
                                </section>
                            )}
                        </section>
                    )}
                    {historyError && <p role='alert' className='text-sm text-ui-danger'>{historyError}</p>}
                </>
            ) : document.body ? <MarkdownRender MDstr={document.body} /> : null}
        </section>
    )
}
