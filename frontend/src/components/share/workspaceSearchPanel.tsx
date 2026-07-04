'use client'

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronRight, Files, Loader2, Replace, Search, Sparkles } from 'lucide-react'
import { updateShare } from '@/utils/share/put'
import {
    WorkspaceFileMatches,
    countMatches,
    flattenWorkspaceTree,
    loadWorkspaceFiles,
    replaceInContent,
    searchIndexedFiles,
    type IndexedWorkspaceFile,
} from './workspaceSearchUtils'

type WorkspaceSearchPanelProps = {
    tree: Tree | null
    share: Share | null
    editingContent: string
    setShare: Dispatch<SetStateAction<Share | null>>
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
    setError: Dispatch<SetStateAction<string | boolean | null>>
}

const inputClass = 'w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:bg-ui-panel'
const iconButtonClass = 'grid h-8 w-8 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-muted transition hover:border-ui-primary hover:text-ui-text'

export default function WorkspaceSearchPanel({
    tree,
    share,
    editingContent,
    setShare,
    setEditorPatch,
    setError,
}: WorkspaceSearchPanelProps) {
    const [query, setQuery] = useState('')
    const [replacement, setReplacement] = useState('')
    const [include, setInclude] = useState('')
    const [exclude, setExclude] = useState('node_modules,.next,dist,build')
    const [caseSensitive, setCaseSensitive] = useState(false)
    const [wholeWord, setWholeWord] = useState(false)
    const [regex, setRegex] = useState(false)
    const [loading, setLoading] = useState(false)
    const [replacing, setReplacing] = useState(false)
    const [results, setResults] = useState<WorkspaceFileMatches[]>([])
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const cacheRef = useRef(new Map<string, IndexedWorkspaceFile>())
    const files = useMemo(() => flattenWorkspaceTree(tree), [tree])
    const resultCount = countMatches(results)

    useEffect(() => {
        const search = query.trim()
        if (!search || !files.length) {
            setResults([])
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
                const nextResults = searchIndexedFiles(indexed, search, {
                    caseSensitive,
                    wholeWord,
                    regex,
                    include,
                    exclude,
                })

                if (!cancelled) {
                    setResults(nextResults)
                    setExpanded(new Set(nextResults.slice(0, 8).map(group => group.file.id)))
                }
            } catch (error) {
                console.error(error)
                if (!cancelled) {
                    setError('Search failed. Check the query or regex syntax.')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }, 220)

        return () => {
            cancelled = true
            window.clearTimeout(timeout)
        }
    }, [caseSensitive, editingContent, exclude, files, include, query, regex, setError, share, wholeWord])

    async function replaceAll() {
        if (!query.trim() || !resultCount) {
            return
        }

        setReplacing(true)
        try {
            let changedFiles = 0
            for (const group of results) {
                const cached = cacheRef.current.get(group.file.id)
                if (!cached) {
                    continue
                }

                const nextContent = replaceInContent(cached.content, query, replacement, {
                    caseSensitive,
                    wholeWord,
                    regex,
                    include,
                    exclude,
                })

                if (nextContent === cached.content) {
                    continue
                }

                const updated = await updateShare(group.file.id, { content: nextContent })
                if (!updated) {
                    setError(`Could not update ${group.file.path}.`)
                    continue
                }

                changedFiles += 1
                const nextCached = { ...cached, content: nextContent }
                cacheRef.current.set(group.file.id, nextCached)
                if (share?.id === group.file.id) {
                    setShare(updated)
                    setEditorPatch({ value: nextContent, nonce: Date.now() })
                }
            }

            setError(changedFiles
                ? `Replaced ${resultCount} matches across ${changedFiles} files.`
                : 'No files changed.'
            )
        } catch (error) {
            console.error(error)
            setError('Replace failed. Nothing else was changed after the error.')
        } finally {
            setReplacing(false)
        }
    }

    function toggleExpanded(id: string) {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    return (
        <section className='flex h-full w-[min(22rem,calc(100vw-5rem))] flex-col overflow-hidden rounded-xl border border-ui-border bg-ui-panel shadow-2xl backdrop-blur-md md:min-w-[310px] md:max-w-[420px]'>
            <header className='flex items-center justify-between border-b border-ui-border px-3 py-3'>
                <div>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.22em] text-ui-muted'>Search</p>
                    <h2 className='text-sm font-semibold text-ui-text'>Workspace search</h2>
                </div>
                <div className='flex items-center gap-1'>
                    <Sparkles className='h-4 w-4 text-ui-primary' />
                    <span className='rounded-full border border-ui-border bg-ui-raised px-2 py-1 text-[11px] text-ui-muted'>
                        {files.length} files
                    </span>
                </div>
            </header>

            <div className='space-y-2 border-b border-ui-border p-3'>
                <div className='relative'>
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />
                    <input
                        aria-label='Search files'
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder='Search files'
                        className={`${inputClass} pl-9`}
                    />
                </div>
                <div className='relative'>
                    <Replace className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />
                    <input
                        aria-label='Replace text'
                        value={replacement}
                        onChange={(event) => setReplacement(event.target.value)}
                        placeholder='Replace'
                        className={`${inputClass} pl-9`}
                    />
                </div>
                <div className='grid grid-cols-2 gap-2'>
                    <input aria-label='Files to include' value={include} onChange={(event) => setInclude(event.target.value)} placeholder='files to include' className={inputClass} />
                    <input aria-label='Files to exclude' value={exclude} onChange={(event) => setExclude(event.target.value)} placeholder='files to exclude' className={inputClass} />
                </div>
                <div className='flex items-center justify-between gap-2'>
                    <div className='flex items-center gap-1'>
                        <Toggle active={caseSensitive} onClick={() => setCaseSensitive(prev => !prev)} label='Aa' title='Match case' />
                        <Toggle active={wholeWord} onClick={() => setWholeWord(prev => !prev)} label='ab' title='Whole word' />
                        <Toggle active={regex} onClick={() => setRegex(prev => !prev)} label='.*' title='Regular expression' />
                    </div>
                    <button
                        type='button'
                        disabled={!resultCount || replacing}
                        onClick={replaceAll}
                        className='inline-flex items-center gap-2 rounded-lg border border-ui-primary bg-ui-primary/10 px-3 py-2 text-xs font-semibold text-ui-primary transition hover:bg-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-40'
                    >
                        {replacing ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Replace className='h-3.5 w-3.5' />}
                        Replace all
                    </button>
                </div>
            </div>

            <div className='flex items-center justify-between border-b border-ui-border px-3 py-2 text-xs text-ui-muted'>
                <span>
                    {loading ? 'Indexing workspace...' : `${resultCount} results in ${results.length} files`}
                </span>
                {loading ? <Loader2 className='h-4 w-4 animate-spin text-ui-primary' /> : <Files className='h-4 w-4' />}
            </div>

            <div className='min-h-0 flex-1 overflow-auto p-2'>
                {!query.trim() ? (
                    <EmptyState title='Search everything' body='Find and replace across this share without leaving the workspace.' />
                ) : null}
                {query.trim() && !loading && results.length === 0 ? (
                    <EmptyState title='No matches' body='Try a broader query or adjust include/exclude filters.' />
                ) : null}
                {results.map(group => {
                    const isOpen = expanded.has(group.file.id)
                    return (
                        <article key={group.file.id} className='mb-2 overflow-hidden rounded-xl border border-ui-border bg-ui-raised'>
                            <button type='button' onClick={() => toggleExpanded(group.file.id)} className='flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-ui-panel'>
                                {isOpen ? <ChevronDown className='h-4 w-4 text-ui-muted' /> : <ChevronRight className='h-4 w-4 text-ui-muted' />}
                                <div className='min-w-0 flex-1'>
                                    <p className='truncate text-sm font-medium text-ui-text'>{group.file.name}</p>
                                    <p className='truncate text-[11px] text-ui-muted'>{group.file.path}</p>
                                </div>
                                <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-[11px] text-ui-muted'>{group.matches.length}</span>
                            </button>
                            {isOpen ? (
                                <div className='border-t border-ui-border py-1'>
                                    {group.matches.slice(0, 80).map(match => (
                                        <Link
                                            key={match.id}
                                            prefetch={false}
                                            href={`/s/${match.file.id}?line=${match.line}&q=${encodeURIComponent(query)}`}
                                            className='group flex gap-2 px-3 py-2 text-xs transition hover:bg-ui-primary/10'
                                        >
                                            <span className='w-8 shrink-0 text-right font-mono text-ui-muted'>{match.line}</span>
                                            <span className='min-w-0 flex-1'>
                                                {match.functionName ? <span className='mb-1 block text-[10px] uppercase tracking-[0.16em] text-ui-primary'>{match.functionName}</span> : null}
                                                <HighlightedPreview preview={match.preview} query={query} caseSensitive={caseSensitive} />
                                            </span>
                                            <ArrowRight className='mt-0.5 h-3.5 w-3.5 shrink-0 text-ui-muted transition group-hover:text-ui-primary' />
                                        </Link>
                                    ))}
                                </div>
                            ) : null}
                        </article>
                    )
                })}
            </div>
        </section>
    )
}

function Toggle({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: string; title: string }) {
    return (
        <button
            type='button'
            title={title}
            onClick={onClick}
            className={`${iconButtonClass} ${active ? 'border-ui-primary bg-ui-primary/15 text-ui-primary' : ''}`}
        >
            <span className='text-xs font-bold'>{label}</span>
        </button>
    )
}

function EmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div className='grid min-h-48 place-items-center rounded-xl border border-dashed border-ui-border bg-ui-raised p-6 text-center'>
            <div>
                <p className='text-sm font-semibold text-ui-text'>{title}</p>
                <p className='mt-2 text-xs leading-5 text-ui-muted'>{body}</p>
            </div>
        </div>
    )
}

function HighlightedPreview({ preview, query, caseSensitive }: { preview: string; query: string; caseSensitive: boolean }) {
    const index = caseSensitive
        ? preview.indexOf(query)
        : preview.toLowerCase().indexOf(query.toLowerCase())

    if (index < 0 || !query) {
        return <span className='truncate text-ui-muted'>{preview}</span>
    }

    return (
        <span className='block truncate font-mono text-ui-muted'>
            {preview.slice(0, index)}
            <mark className='rounded bg-ui-primary/20 px-0.5 text-ui-text'>{preview.slice(index, index + query.length)}</mark>
            {preview.slice(index + query.length)}
        </span>
    )
}
