'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, LockKeyhole, Plus, Trash2 } from 'lucide-react'
import { createNote, deleteNote, fetchNotes, updateNote } from '@/utils/notes/client'
import { DashboardPanel } from '@/components/dashboard/ui'

const emptyDraft = { title: '', content: '' }

export default function NotesClient() {
    const [notes, setNotes] = useState<Note[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [draft, setDraft] = useState(emptyDraft)
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)
    const selected = useMemo(() => notes.find((note) => note.id === selectedId) || null, [notes, selectedId])

    useEffect(() => {
        void load()
    }, [])

    useEffect(() => {
        if (!selected) {
            setDraft(emptyDraft)
            return
        }

        setDraft({ title: selected.title, content: selected.content })
    }, [selected])

    async function load() {
        setBusy(true)
        try {
            const next = await fetchNotes()
            setNotes(next)
            setSelectedId((current) => current && next.some((note) => note.id === current) ? current : next[0]?.id || '')
            setMessage('')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not load notes.')
        } finally {
            setBusy(false)
        }
    }

    async function save() {
        if (!draft.title.trim() && !draft.content.trim()) {
            setMessage('Write something first.')
            return
        }

        setBusy(true)
        try {
            const saved = selected
                ? await updateNote(selected.id, draft)
                : await createNote(draft)
            setNotes((current) => {
                const rest = current.filter((note) => note.id !== saved.id)
                return [saved, ...rest]
            })
            setSelectedId(saved.id)
            setMessage('Saved.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not save note.')
        } finally {
            setBusy(false)
        }
    }

    async function remove() {
        if (!selected) return
        setBusy(true)
        try {
            await deleteNote(selected.id)
            setNotes((current) => current.filter((note) => note.id !== selected.id))
            setSelectedId('')
            setDraft(emptyDraft)
            setMessage('Deleted.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not delete note.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className='grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]'>
            <DashboardPanel className='min-h-80 p-3'>
                <div className='mb-3 rounded-lg border border-white/8 bg-white/[0.035] p-3 text-xs leading-5 text-bright/48'>
                    <div className='mb-1 flex items-center gap-2 font-semibold text-bright/70'>
                        <LockKeyhole className='h-3.5 w-3.5' />
                        Private to you
                    </div>
                    Notes sync across dashboard, editor, and mobile surfaces. Quotes live separately on the motivation wall.
                </div>
                <button
                    onClick={() => {
                        setSelectedId('')
                        setDraft(emptyDraft)
                    }}
                    className='mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/7 px-3 py-2 text-sm font-semibold text-bright transition hover:bg-white/10'
                >
                    <Plus className='h-4 w-4' />
                    New note
                </button>
                <div className='grid gap-2'>
                    {notes.map((note) => (
                        <button
                            key={note.id}
                            onClick={() => setSelectedId(note.id)}
                            className={`rounded-xl border px-3 py-3 text-left transition ${
                                note.id === selectedId
                                    ? 'border-white/14 bg-white/12 text-bright'
                                    : 'border-white/7 bg-white/[0.035] text-bright/70 hover:bg-white/7'
                            }`}
                        >
                            <div className='truncate text-sm font-semibold'>{note.title || 'Untitled'}</div>
                            <div className='mt-1 truncate text-xs text-bright/42'>{formatNoteDate(note.updated_at)}</div>
                        </button>
                    ))}
                    {!notes.length && <div className='rounded-lg border border-dashed border-white/10 p-5 text-center text-sm text-bright/40'>No private notes yet.</div>}
                </div>
            </DashboardPanel>

            <DashboardPanel className='p-4 sm:p-5'>
                <div className='grid gap-3'>
                    <input
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        placeholder='Title'
                        className='rounded-xl border border-white/10 bg-black/18 px-4 py-3 text-lg font-semibold text-bright outline-none transition placeholder:text-bright/30 focus:border-white/18'
                    />
                    <textarea
                        value={draft.content}
                        onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                        placeholder='Write a private note...'
                        className='min-h-96 resize-none rounded-xl border border-white/10 bg-black/18 px-4 py-3 text-sm leading-6 text-bright outline-none transition placeholder:text-bright/30 focus:border-white/18'
                    />
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <p className='text-sm text-bright/45'>{message || (busy ? 'Working...' : selected ? `Last edited from ${formatSource(selected.source)}.` : 'Private notes are editable here and available to the authenticated app surfaces.')}</p>
                        <div className='flex gap-2'>
                            {selected && (
                                <button onClick={() => void remove()} className='flex items-center gap-2 rounded-xl border border-red-300/16 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/16'>
                                    <Trash2 className='h-4 w-4' />
                                    Delete
                                </button>
                            )}
                            <button onClick={() => void save()} className='flex items-center gap-2 rounded-xl border border-white/12 bg-white/88 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white'>
                                <Check className='h-4 w-4' />
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </DashboardPanel>
        </div>
    )
}

function formatNoteDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatSource(value: string) {
    if (!value) return 'app'
    return value.replace(/[-_]/g, ' ')
}
