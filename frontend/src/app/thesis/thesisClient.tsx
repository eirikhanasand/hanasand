'use client'

import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import MarkdownRender from '@/components/markdown/markdown'
import type { ThesisDocument } from '@/utils/thesis'

export default function ThesisClient({ initialDocument, canEdit }: { initialDocument: ThesisDocument, canEdit: boolean }) {
    const [document, setDocument] = useState(initialDocument)
    const [saved, setSaved] = useState(initialDocument)
    const [editingTitle, setEditingTitle] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const dirty = document.title !== saved.title || document.body !== saved.body

    useEffect(() => {
        if (!dirty) return
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [dirty])

    async function save() {
        setSaving(true)
        setMessage('')
        try {
            const response = await fetch('/api/thesis', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(document),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'The thesis could not be saved.')
            setSaved(document)
            setMessage('Saved')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'The thesis could not be saved. Your draft is still in the editor.')
        } finally {
            setSaving(false)
        }
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
                    onChange={event => setDocument({ ...document, title: event.target.value })}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === 'Escape') setEditingTitle(false)
                    }}
                />
            ) : (
                <h1 className='text-4xl font-semibold leading-tight'>
                    {canEdit ? (
                        <button
                            type='button'
                            aria-label='Edit title'
                            className='w-full rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ui-primary'
                            onClick={() => setEditingTitle(true)}
                        >
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
                        onChange={event => setDocument({ ...document, body: event.target.value })}
                    />
                    <div className='flex items-center gap-4'>
                        <button type='button' disabled={!dirty || saving} onClick={save} className='rounded-lg bg-ui-primary px-4 py-2 font-semibold text-ui-canvas disabled:opacity-50'>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                        <p role='status' className='text-sm text-ui-muted'>{message || (dirty ? 'Unsaved changes' : '')}</p>
                    </div>
                </>
            ) : document.body ? <MarkdownRender MDstr={document.body} /> : null}
        </section>
    )
}
