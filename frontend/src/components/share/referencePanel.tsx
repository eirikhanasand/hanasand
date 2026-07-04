'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Braces, ChevronDown, Loader2, SearchCode, X } from 'lucide-react'
import {
    WorkspaceFileMatches,
    extractClickedToken,
    findSymbolDefinitions,
    flattenWorkspaceTree,
    loadWorkspaceFiles,
    searchIndexedFiles,
    type IndexedWorkspaceFile,
    type WorkspaceMatch,
} from './workspaceSearchUtils'

type ReferencePanelProps = {
    tree: Tree | null
    share: Share | null
    clickedWord: string | null
    setClickedWord: (word: string | null) => void
    editingContent: string
}

export default function ReferencePanel({
    tree,
    share,
    clickedWord,
    setClickedWord,
    editingContent,
}: ReferencePanelProps) {
    const token = extractClickedToken(clickedWord)
    const [query, setQuery] = useState(token)
    const [loading, setLoading] = useState(false)
    const [definitions, setDefinitions] = useState<WorkspaceMatch[]>([])
    const [references, setReferences] = useState<WorkspaceFileMatches[]>([])
    const cacheRef = useRef(new Map<string, IndexedWorkspaceFile>())
    const files = useMemo(() => flattenWorkspaceTree(tree), [tree])
    const referenceCount = references.reduce((count, group) => count + group.matches.length, 0)

    useEffect(() => {
        setQuery(token)
    }, [token])

    useEffect(() => {
        const cleanQuery = query.trim()
        if (!cleanQuery || !files.length) {
            setDefinitions([])
            setReferences([])
            return
        }

        let cancelled = false
        const timeout = window.setTimeout(async () => {
            setLoading(true)
            try {
                const indexed = await loadWorkspaceFiles({
                    files,
                    activeShare: share,
                    activeContent: editingContent,
                    cache: cacheRef.current,
                })

                if (!cancelled) {
                    setDefinitions(findSymbolDefinitions(indexed, cleanQuery).slice(0, 24))
                    setReferences(searchIndexedFiles(indexed, cleanQuery, {
                        caseSensitive: true,
                        wholeWord: true,
                        regex: false,
                        include: '',
                        exclude: 'node_modules,.next,dist,build',
                    }))
                }
            } catch (error) {
                console.error(error)
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }, 180)

        return () => {
            cancelled = true
            window.clearTimeout(timeout)
        }
    }, [editingContent, files, query, share])

    return (
        <section className='overflow-hidden rounded-xl border border-ui-border bg-ui-panel shadow-lg backdrop-blur-md'>
            <header className='flex items-center gap-2 border-b border-ui-border px-3 py-3'>
                <button
                    type='button'
                    aria-label='Clear symbol reference search'
                    onClick={() => setClickedWord(null)}
                    className='grid h-8 w-8 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-text'
                >
                    {token ? <ArrowLeft className='h-4 w-4' /> : <Braces className='h-4 w-4' />}
                </button>
                <div className='min-w-0 flex-1'>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.22em] text-ui-muted'>All symbols</p>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder='Click code or search a symbol'
                        className='mt-1 w-full bg-transparent text-sm font-semibold text-ui-text outline-none placeholder:text-ui-muted'
                    />
                </div>
                {loading ? <Loader2 className='h-4 w-4 animate-spin text-ui-primary' /> : <SearchCode className='h-4 w-4 text-ui-muted' />}
            </header>

            <div className='border-b border-ui-border bg-ui-raised px-3 py-2'>
                <div className='flex items-center justify-between text-xs text-ui-muted'>
                    <span>{referenceCount} references</span>
                    <span>{definitions.length} definitions</span>
                </div>
            </div>

            <div className='max-h-[58vh] overflow-auto p-2'>
                {!query.trim() ? (
                    <EmptyReference />
                ) : null}

                {definitions.length ? (
                    <ReferenceGroup
                        title='Definitions'
                        matches={definitions}
                        accent
                    />
                ) : null}

                {references.length ? (
                    <>
                        <div className='my-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ui-muted'>
                            <ChevronDown className='h-3.5 w-3.5' />
                            References
                        </div>
                        {references.map(group => (
                            <ReferenceGroup
                                key={group.file.id}
                                title={group.file.path}
                                matches={group.matches.slice(0, 32)}
                            />
                        ))}
                    </>
                ) : null}

                {query.trim() && !loading && !definitions.length && !references.length ? (
                    <div className='rounded-xl border border-dashed border-ui-border p-5 text-center text-xs leading-5 text-ui-muted'>
                        No symbol trail yet. Try selecting an identifier in the editor or search for a function name.
                    </div>
                ) : null}
            </div>
        </section>
    )
}

function ReferenceGroup({ title, matches, accent = false }: { title: string; matches: WorkspaceMatch[]; accent?: boolean }) {
    return (
        <article className='mb-2 overflow-hidden rounded-xl border border-ui-border bg-ui-raised'>
            <div className='flex items-center justify-between border-b border-ui-border px-3 py-2'>
                <p className={`truncate text-xs font-semibold ${accent ? 'text-ui-primary' : 'text-ui-text'}`}>{title}</p>
                <span className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] text-ui-muted'>{matches.length}</span>
            </div>
            <div className='py-1'>
                {matches.map(match => (
                    <Link
                        key={match.id}
                        prefetch={false}
                        href={`/s/${match.file.id}?line=${match.line}`}
                        className='group flex gap-2 px-3 py-2 text-xs transition hover:bg-ui-primary/10'
                    >
                        <span className='w-8 shrink-0 text-right font-mono text-ui-muted'>{match.line}</span>
                        <span className='min-w-0 flex-1'>
                            {match.functionName ? <span className='mb-1 block text-[10px] uppercase tracking-[0.16em] text-ui-primary'>{match.functionName}</span> : null}
                            <span className='block truncate font-mono text-ui-muted'>{match.preview}</span>
                        </span>
                        <ArrowRight className='mt-0.5 h-3.5 w-3.5 shrink-0 text-ui-muted transition group-hover:text-ui-primary' />
                    </Link>
                ))}
            </div>
        </article>
    )
}

function EmptyReference() {
    return (
        <div className='rounded-xl border border-dashed border-ui-border bg-ui-raised p-5 text-center'>
            <X className='mx-auto h-4 w-4 text-ui-muted' />
            <p className='mt-3 text-sm font-semibold text-ui-text'>Follow code without leaving flow</p>
            <p className='mt-2 text-xs leading-5 text-ui-muted'>Click an identifier in the editor to see definitions and every call site across the share.</p>
        </div>
    )
}
