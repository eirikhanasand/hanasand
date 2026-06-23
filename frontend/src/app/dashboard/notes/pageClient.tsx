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
                <div className='mb-3 rounded-lg border border-[#dfe5ee] bg-[#f7f9fc] p-3 text-xs leading-5 text-[#596170]'>
                    <div className='mb-1 flex items-center gap-2 font-semibold text-[#171a21]'>
                        <LockKeyhole className='h-3.5 w-3.5' />
                        Private to you
                    </div>
                    Notes stay with this monitoring workspace for watchlist decisions, customer context, and follow-up tasks.
                </div>
                <button
                    onClick={() => {
                        setSelectedId('')
                        setDraft(emptyDraft)
                    }}
                    className='mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm font-semibold text-[#364152] transition hover:bg-[#f2f5f9]'
                >
                    <Plus className='h-4 w-4' />
                    New note
                </button>
                <div className='grid gap-2'>
                    {notes.map((note) => (
                        <button
                            key={note.id}
                            onClick={() => setSelectedId(note.id)}
                            className={`rounded-lg border px-3 py-3 text-left transition ${
                                note.id === selectedId
                                    ? 'border-[#3056d3] bg-[#eef3ff] text-[#171a21]'
                                    : 'border-[#dfe5ee] bg-white text-[#364152] hover:bg-[#f7f9fc]'
                            }`}
                        >
                            <div className='truncate text-sm font-semibold'>{note.title || 'Untitled'}</div>
                            <div className='mt-1 truncate text-xs text-[#687386]'>{formatNoteDate(note.updated_at)}</div>
                        </button>
                    ))}
                    {!notes.length && <div className='rounded-lg border border-dashed border-[#d8dee9] p-5 text-center text-sm text-[#596170]'>No private notes yet.</div>}
                </div>
            </DashboardPanel>

            <DashboardPanel className='p-4 sm:p-5'>
                <div className='grid gap-3'>
                    <input
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        placeholder='Title'
                        className='rounded-lg border border-[#d8dee9] bg-white px-4 py-3 text-lg font-semibold text-[#171a21] outline-none transition placeholder:text-[#98a2b3] focus:border-[#3056d3] focus:ring-3 focus:ring-[#3056d3]/10'
                    />
                    <textarea
                        value={draft.content}
                        onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                        placeholder='Write a watchlist, actor review, or customer follow-up note...'
                        className='min-h-96 resize-none rounded-lg border border-[#d8dee9] bg-white px-4 py-3 text-sm leading-6 text-[#171a21] outline-none transition placeholder:text-[#98a2b3] focus:border-[#3056d3] focus:ring-3 focus:ring-[#3056d3]/10'
                    />
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <p className='text-sm text-[#687386]'>{message || (busy ? 'Working...' : selected ? `Last edited from ${formatSource(selected.source)}.` : 'Private notes are available in your signed-in monitoring workspace.')}</p>
                        <div className='flex gap-2'>
                            {selected && (
                                <button onClick={() => void remove()} className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100'>
                                    <Trash2 className='h-4 w-4' />
                                    Delete
                                </button>
                            )}
                            <button onClick={() => void save()} className='flex items-center gap-2 rounded-lg bg-[#22252d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#111318]'>
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
