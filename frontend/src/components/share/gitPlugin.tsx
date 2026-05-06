'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, GitBranch, GitCommitHorizontal, GitPullRequestArrow, LoaderCircle, LockKeyhole, RotateCcw, SendHorizontal } from 'lucide-react'
import {
    attachGitHubCredential,
    commitRepositoryWorkspace,
    getRepositoryGitStatus,
    importGitHubRepository,
    persistGitHubRepository,
    pullRepositoryWorkspace,
    pushRepositoryWorkspace,
} from '@/components/ai/github'
import { importRepositoryToShare } from '@/utils/ai/importRepositoryToShare'
import { syncRepositoryToShare } from '@/utils/ai/syncRepositoryToShare'
import { getCookie } from '@/utils/cookies/cookies'
import ErrorNotice from '@/components/error/errorNotice'

type GitPluginProps = {
    shareRouteId: string
    share: Share | null
}

type StoredGitWorkspace = {
    input: string
    fullName: string
    branch: string
    sourcePath: string
    updatedAt: string
    lastSyncedAt?: string
    autoPullMinutes?: number
}

const storagePrefix = 'hanasand.share.git.'
const autoPullStoragePrefix = 'hanasand.share.git.autopull.'
const autoPullOptions = [
    { label: 'Off', value: 0 },
    { label: '5 min', value: 5 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '60 min', value: 60 },
]

export default function GitPlugin({ shareRouteId, share }: GitPluginProps) {
    const [input, setInput] = useState('')
    const [githubToken, setGitHubToken] = useState('')
    const [status, setStatus] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState<'import' | 'pull' | 'status' | 'commit' | 'push' | null>(null)
    const [stored, setStored] = useState<StoredGitWorkspace | null>(null)
    const [gitStatus, setGitStatus] = useState<AIGitStatus | null>(null)
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
    const [commitMessage, setCommitMessage] = useState('')
    const [autoPullMinutes, setAutoPullMinutes] = useState(0)
    const [syncProgress, setSyncProgress] = useState<AISyncProgress | null>(null)
    const [syncStartedAt, setSyncStartedAt] = useState<number | null>(null)
    const [languageOverview, setLanguageOverview] = useState<LanguageStat[]>([])
    const userId = typeof document !== 'undefined' ? getCookie('id') || null : null
    const accessToken = typeof document !== 'undefined' ? getCookie('access_token') || null : null
    const isSignedIn = Boolean(userId && accessToken)
    const currentInput = useMemo(() => {
        if (input.trim()) return input.trim()
        if (stored?.input) return stored.input
        if (share?.git) return share.git
        return ''
    }, [input, share?.git, stored])

    useEffect(() => {
        const storedWorkspace = readStoredGitWorkspace(shareRouteId)
        setStored(storedWorkspace)
        if (storedWorkspace?.autoPullMinutes !== undefined) {
            setAutoPullMinutes(storedWorkspace.autoPullMinutes)
        }
        if (storedWorkspace?.input) {
            setInput(storedWorkspace.input)
        } else if (share?.git) {
            setInput(share.git)
        }
    }, [share?.git, shareRouteId])

    useEffect(() => {
        if (typeof window === 'undefined') return
        const storedMinutes = Number(window.localStorage.getItem(`${autoPullStoragePrefix}${shareRouteId}`) || '0')
        setAutoPullMinutes(autoPullOptions.some(option => option.value === storedMinutes) ? storedMinutes : 0)
    }, [shareRouteId])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(`${autoPullStoragePrefix}${shareRouteId}`, String(autoPullMinutes))
        }
        if (stored) {
            rememberGitWorkspace(shareRouteId, { ...stored, autoPullMinutes })
            setStored(prev => prev ? { ...prev, autoPullMinutes } : prev)
        }
        if (!autoPullMinutes || !isSignedIn || !currentInput) return

        const timer = window.setInterval(() => {
            if (!pending) {
                void syncRepository('pull', { automatic: true })
            }
        }, autoPullMinutes * 60 * 1000)

        return () => window.clearInterval(timer)
    }, [autoPullMinutes, currentInput, isSignedIn, pending, shareRouteId])

    async function syncRepository(mode: 'import' | 'pull', options: { automatic?: boolean } = {}) {
        if (!isSignedIn) {
            setError('Sign in to load Git repositories.')
            return
        }

        if (!currentInput) {
            setError('Paste a GitHub repository URL or owner/repo first.')
            return
        }

        setPending(mode)
        setError(null)
        setSyncProgress(null)
        setSyncStartedAt(Date.now())
        setLanguageOverview([])
        setStatus(mode === 'pull' ? options.automatic ? 'Auto-pulling the latest repository files...' : 'Pulling the latest repository files...' : 'Loading repository into this workspace...')

        try {
            const existingId = mode === 'pull' ? share?.id || shareRouteId : undefined
            const repo = await importGitHubRepository(currentInput, existingId, githubToken)
            setLanguageOverview(buildLanguageOverview(repo.files))
            setSyncProgress({ syncedFiles: 0, totalFiles: repo.files.length, currentPath: null })
            const persistedRepo = {
                ...repo,
                syncStatus: 'syncing' as const,
            }

            await persistGitHubRepository(persistedRepo)
            if (githubToken.trim()) {
                await attachGitHubCredential(repo.id, githubToken.trim())
            }

            if (mode === 'pull' && (share?.id || shareRouteId) === repo.id) {
                await syncRepositoryToShare({ repo: persistedRepo, token: accessToken, userId, onProgress: setSyncProgress })
            } else {
                await importRepositoryToShare({ repo: persistedRepo, token: accessToken, userId, onProgress: setSyncProgress })
            }

            const readyRepo = {
                ...persistedRepo,
                syncStatus: 'ready' as const,
                lastSyncedAt: new Date().toISOString(),
                lastSyncError: null,
            }
            const syncedAt = readyRepo.lastSyncedAt
            await persistGitHubRepository(readyRepo)
            rememberGitWorkspace(repo.id, {
                input: repo.sourceUrl || currentInput,
                fullName: repo.fullName,
                branch: repo.branch,
                sourcePath: repo.sourcePath || '',
                updatedAt: syncedAt,
                lastSyncedAt: syncedAt,
                autoPullMinutes,
            })
            setStored(readStoredGitWorkspace(repo.id))
            setGitHubToken('')
            setStatus(mode === 'pull' ? options.automatic ? 'Repository auto-pulled in the background.' : 'Repository pulled into the editor.' : 'Repository loaded. Opening it now...')

            if (options.automatic) {
                await loadGitStatus(repo.id)
            } else if (repo.id !== shareRouteId || mode === 'import') {
                window.location.assign(`/s/${repo.id}`)
            } else {
                window.location.reload()
            }
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : 'Repository sync failed.'
            setError(message)
            setStatus(null)
        } finally {
            setPending(null)
            setSyncStartedAt(null)
        }
    }

    async function loadGitStatus(repositoryId = shareRouteId) {
        if (!isSignedIn) {
            setError('Sign in to inspect Git changes.')
            return
        }

        setPending('status')
        setError(null)
        setStatus('Checking Git changes...')

        try {
            const nextStatus = await getRepositoryGitStatus(repositoryId, share?.id || shareRouteId)
            setGitStatus(nextStatus)
            setSelectedPaths(new Set(nextStatus.files.map(file => file.path)))
            if (stored) {
                const checkedAt = new Date().toISOString()
                const nextStored = { ...stored, updatedAt: checkedAt, autoPullMinutes }
                rememberGitWorkspace(shareRouteId, nextStored)
                setStored(nextStored)
            }
            setStatus(nextStatus.files.length ? `${nextStatus.files.length} changed file${nextStatus.files.length === 1 ? '' : 's'} ready to stage.` : 'No Git changes in the editor.')
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to load Git status.')
            setStatus(null)
        } finally {
            setPending(null)
        }
    }

    async function pullGitWorkspace() {
        if (!isSignedIn) {
            setError('Sign in to pull Git changes.')
            return
        }

        setPending('pull')
        setError(null)
        setStatus('Pulling the cached Git worktree...')
        try {
            const nextStatus = await pullRepositoryWorkspace(shareRouteId)
            setGitStatus(nextStatus)
            setSelectedPaths(new Set(nextStatus.files.map(file => file.path)))
            const pulledAt = new Date().toISOString()
            if (stored) {
                const nextStored = { ...stored, updatedAt: pulledAt, lastSyncedAt: pulledAt, autoPullMinutes }
                rememberGitWorkspace(shareRouteId, nextStored)
                setStored(nextStored)
            }
            setStatus('Remote changes pulled into the Git worktree.')
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to pull Git worktree.')
            setStatus(null)
        } finally {
            setPending(null)
        }
    }

    async function commitSelectedFiles() {
        if (!isSignedIn) {
            setError('Sign in to commit Git changes.')
            return
        }

        const paths = [...selectedPaths]
        setPending('commit')
        setError(null)
        setStatus(`Committing ${paths.length} staged file${paths.length === 1 ? '' : 's'}...`)
        try {
            const result = await commitRepositoryWorkspace(shareRouteId, share?.id || shareRouteId, commitMessage, paths)
            setGitStatus(result.status)
            setSelectedPaths(new Set(result.status.files.map(file => file.path)))
            setCommitMessage('')
            setStatus(`Committed ${result.commit}.`)
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to commit staged files.')
            setStatus(null)
        } finally {
            setPending(null)
        }
    }

    async function pushGitWorkspace() {
        if (!isSignedIn) {
            setError('Sign in to push Git changes.')
            return
        }

        setPending('push')
        setError(null)
        setStatus('Pushing commits...')
        try {
            const nextStatus = await pushRepositoryWorkspace(shareRouteId)
            setGitStatus(nextStatus)
            setSelectedPaths(new Set(nextStatus.files.map(file => file.path)))
            if (stored) {
                const pushedAt = new Date().toISOString()
                const nextStored = { ...stored, updatedAt: pushedAt, lastSyncedAt: pushedAt, autoPullMinutes }
                rememberGitWorkspace(shareRouteId, nextStored)
                setStored(nextStored)
            }
            setStatus('Pushed to the remote repository.')
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Failed to push repository.')
            setStatus(null)
        } finally {
            setPending(null)
        }
    }

    function togglePath(path: string) {
        setSelectedPaths(prev => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }

    function stageAll() {
        setSelectedPaths(new Set((gitStatus?.files || []).map(file => file.path)))
    }

    return (
        <section className='rounded-lg bg-dark/35 p-3 outline outline-dark'>
            <div className='flex items-start gap-2'>
                <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f07d33]/12 text-[#f07d33] outline outline-[#f07d33]/18'>
                    <GitBranch className='h-4 w-4' />
                </div>
                <div className='min-w-0'>
                    <div className='text-xs font-semibold text-bright/86'>Git</div>
                    <div className='mt-0.5 text-[11px] leading-4 text-bright/42'>
                        Import or pull from GitHub, Forgejo, GitLab, or any public Git URL.
                    </div>
                </div>
            </div>

            <div className='mt-3 grid gap-2'>
                {!isSignedIn ? (
                    <div className='rounded-lg bg-amber-400/8 p-2 text-[11px] leading-4 text-amber-100/82 outline outline-amber-200/10'>
                        <div className='flex items-center gap-2 font-semibold'>
                            <LockKeyhole className='h-3.5 w-3.5' />
                            Sign in for Git access
                        </div>
                        <Link href='/login' className='mt-2 inline-block underline-offset-4 hover:underline'>
                            Log in to pull public repositories and private GitHub repositories
                        </Link>
                    </div>
                ) : null}

                <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder='owner/repo, GitHub URL, or public Git URL'
                    spellCheck={false}
                    className='min-w-0 rounded-lg bg-black/18 px-2.5 py-2 text-xs text-bright/86 outline outline-dark placeholder:text-bright/28'
                />
                <input
                    value={githubToken}
                    onChange={(event) => setGitHubToken(event.target.value)}
                    placeholder='GitHub token for private GitHub repos'
                    type='password'
                    autoComplete='off'
                    spellCheck={false}
                    className='min-w-0 rounded-lg bg-black/18 px-2.5 py-2 text-xs text-bright/86 outline outline-dark placeholder:text-bright/28'
                />

                <div className='grid grid-cols-2 gap-2'>
                    <button
                        type='button'
                        onClick={() => void syncRepository('import')}
                        disabled={!isSignedIn || Boolean(pending)}
                        className='inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#f07d33] px-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-55'
                    >
                        {pending === 'import' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitBranch className='h-3.5 w-3.5' />}
                        Load
                    </button>
                    <button
                        type='button'
                        onClick={() => void syncRepository('pull')}
                        disabled={!isSignedIn || Boolean(pending) || !currentInput}
                        className='inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-dark/45 px-2 text-xs font-semibold text-bright/82 outline outline-dark transition-colors hover:text-[#f07d33] disabled:opacity-55'
                    >
                        {pending === 'pull' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitPullRequestArrow className='h-3.5 w-3.5' />}
                        Pull
                    </button>
                </div>

                <div className='rounded-lg bg-black/12 p-2.5 outline outline-dark'>
                    <div className='flex items-center justify-between gap-2'>
                        <div>
                            <div className='text-[11px] font-semibold text-bright/74'>Auto pull</div>
                            <div className='text-[10px] leading-4 text-bright/38'>{autoPullMinutes ? `Syncs remote every ${autoPullMinutes} min while this workspace is open` : 'Disabled for this workspace'}</div>
                        </div>
                        <select
                            value={autoPullMinutes}
                            onChange={(event) => setAutoPullMinutes(Number(event.target.value))}
                            className='h-8 rounded-lg bg-dark/70 px-2 text-[11px] font-semibold text-bright/74 outline outline-dark'
                        >
                            {autoPullOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {(syncProgress || languageOverview.length) ? (
                    <div className='rounded-lg bg-black/12 p-2.5 outline outline-dark'>
                        {syncProgress ? (
                            <SyncProgressMeter progress={syncProgress} startedAt={syncStartedAt} />
                        ) : null}
                        {languageOverview.length ? (
                            <LanguageOverview stats={languageOverview} />
                        ) : null}
                    </div>
                ) : null}

                <div className='rounded-lg bg-black/12 p-2.5 outline outline-dark'>
                    <div className='flex items-center justify-between gap-2'>
                        <div className='min-w-0'>
                            <div className='text-[11px] font-semibold text-bright/74'>Changes</div>
                            <div className='truncate text-[10px] leading-4 text-bright/38'>{gitStatus?.branchSummary || stored?.branch || 'No status loaded'}</div>
                        </div>
                        <button
                            type='button'
                            onClick={() => void loadGitStatus()}
                            disabled={!isSignedIn || Boolean(pending)}
                            className='inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-dark/55 px-2 text-[11px] font-semibold text-bright/78 outline outline-dark transition-colors hover:text-[#f07d33] disabled:opacity-55'
                        >
                            {pending === 'status' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <RotateCcw className='h-3.5 w-3.5' />}
                            Status
                        </button>
                    </div>

                    {gitStatus?.files.length ? (
                        <div className='mt-2 space-y-1.5'>
                            <div className='flex items-center justify-between text-[10px] text-bright/42'>
                                <button type='button' onClick={stageAll} className='font-semibold text-[#f07d33] hover:text-[#ffb080]'>
                                    Stage all
                                </button>
                                <span>{selectedPaths.size}/{gitStatus.files.length} staged</span>
                            </div>
                            <div className='max-h-40 space-y-1 overflow-y-auto pr-1'>
                                {gitStatus.files.map(file => (
                                    <button
                                        key={file.path}
                                        type='button'
                                        onClick={() => togglePath(file.path)}
                                        className='flex min-h-8 w-full items-center gap-2 rounded-lg bg-dark/32 px-2 text-left text-[11px] text-bright/66 outline outline-dark/70 transition-colors hover:text-bright'
                                    >
                                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selectedPaths.has(file.path) ? 'border-[#f07d33] bg-[#f07d33] text-black' : 'border-bright/18'}`}>
                                            {selectedPaths.has(file.path) ? <Check className='h-3 w-3' /> : null}
                                        </span>
                                        <span className='shrink-0 font-mono text-[10px] text-bright/38'>{file.index}{file.workingTree}</span>
                                        <span className='min-w-0 truncate'>{file.path}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : gitStatus ? (
                        <div className='mt-2 rounded-lg bg-dark/24 px-2 py-2 text-[11px] text-bright/46 outline outline-dark'>No changed files.</div>
                    ) : null}
                </div>

                <div className='rounded-lg bg-black/12 p-2.5 outline outline-dark'>
                    <div className='text-[11px] font-semibold text-bright/74'>Commit and push</div>
                    <input
                        value={commitMessage}
                        onChange={(event) => setCommitMessage(event.target.value)}
                        placeholder='Commit message'
                        className='mt-2 min-w-0 rounded-lg bg-black/18 px-2.5 py-2 text-xs text-bright/86 outline outline-dark placeholder:text-bright/28'
                    />
                    <div className='mt-2 grid grid-cols-3 gap-2'>
                        <button
                            type='button'
                            onClick={() => void pullGitWorkspace()}
                            disabled={!isSignedIn || Boolean(pending)}
                            className='inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-dark/45 px-2 text-[11px] font-semibold text-bright/82 outline outline-dark transition-colors hover:text-[#f07d33] disabled:opacity-55'
                        >
                            {pending === 'pull' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitPullRequestArrow className='h-3.5 w-3.5' />}
                            Pull
                        </button>
                        <button
                            type='button'
                            onClick={() => void commitSelectedFiles()}
                            disabled={!isSignedIn || Boolean(pending) || !selectedPaths.size || !commitMessage.trim()}
                            className='inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-dark/45 px-2 text-[11px] font-semibold text-bright/82 outline outline-dark transition-colors hover:text-[#f07d33] disabled:opacity-55'
                        >
                            {pending === 'commit' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitCommitHorizontal className='h-3.5 w-3.5' />}
                            Commit
                        </button>
                        <button
                            type='button'
                            onClick={() => void pushGitWorkspace()}
                            disabled={!isSignedIn || Boolean(pending)}
                            className='inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#f07d33] px-2 text-[11px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-55'
                        >
                            {pending === 'push' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <SendHorizontal className='h-3.5 w-3.5' />}
                            Push
                        </button>
                    </div>
                </div>

                {stored ? (
                    <div className='rounded-lg bg-black/12 px-2.5 py-2 text-[11px] leading-4 text-bright/48 outline outline-dark'>
                        <div className='truncate text-bright/70'>{stored.fullName}</div>
                        <div className='mt-0.5 flex items-center gap-1.5'>
                            <RotateCcw className='h-3 w-3' />
                            {stored.branch}{stored.sourcePath ? ` / ${stored.sourcePath}` : ''}
                        </div>
                        <div className='mt-1 text-bright/42'>Last synced {formatSyncTime(stored.lastSyncedAt || stored.updatedAt)}</div>
                    </div>
                ) : null}
                {status ? <div className='text-[11px] leading-4 text-emerald-200/80'>{status}</div> : null}
                {error ? <ErrorNotice compact message={error} /> : null}
            </div>
        </section>
    )
}

type LanguageStat = {
    language: string
    files: number
    percentage: number
}

function SyncProgressMeter({ progress, startedAt }: { progress: AISyncProgress, startedAt: number | null }) {
    const percentage = progress.totalFiles > 0 ? Math.round((progress.syncedFiles / progress.totalFiles) * 100) : 0
    const eta = formatEta(progress, startedAt)

    return (
        <div>
            <div className='flex items-center justify-between gap-2 text-[11px] font-semibold text-bright/74'>
                <span>Sync progress</span>
                <span>{progress.syncedFiles}/{progress.totalFiles} files</span>
            </div>
            <div className='mt-2 h-2 overflow-hidden rounded-full bg-dark/70 outline outline-dark'>
                <div className='h-full rounded-full bg-[#f07d33]' style={{ width: `${percentage}%` }} />
            </div>
            <div className='mt-1.5 flex items-center justify-between gap-2 text-[10px] leading-4 text-bright/40'>
                <span className='min-w-0 truncate'>{progress.currentPath || 'Preparing files...'}</span>
                <span className='inline-flex shrink-0 items-center gap-1'>
                    <Clock3 className='h-3 w-3' />
                    {eta}
                </span>
            </div>
        </div>
    )
}

function LanguageOverview({ stats }: { stats: LanguageStat[] }) {
    return (
        <div className='mt-3'>
            <div className='text-[11px] font-semibold text-bright/74'>Language overview</div>
            <div className='mt-2 space-y-1.5'>
                {stats.map(stat => (
                    <div key={stat.language}>
                        <div className='mb-1 flex items-center justify-between text-[10px] text-bright/44'>
                            <span>{stat.language}</span>
                            <span>{stat.percentage}% · {stat.files} file{stat.files === 1 ? '' : 's'}</span>
                        </div>
                        <div className='h-1.5 overflow-hidden rounded-full bg-dark/60'>
                            <div className='h-full rounded-full bg-bright/45' style={{ width: `${stat.percentage}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function readStoredGitWorkspace(shareId: string) {
    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(`${storagePrefix}${shareId}`)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<StoredGitWorkspace>
        if (!parsed.input || !parsed.fullName || !parsed.branch) return null
        return {
            input: parsed.input,
            fullName: parsed.fullName,
            branch: parsed.branch,
            sourcePath: parsed.sourcePath || '',
            updatedAt: parsed.updatedAt || '',
            lastSyncedAt: parsed.lastSyncedAt || parsed.updatedAt || '',
            autoPullMinutes: typeof parsed.autoPullMinutes === 'number' ? parsed.autoPullMinutes : undefined,
        }
    } catch {
        return null
    }
}

function rememberGitWorkspace(shareId: string, workspace: StoredGitWorkspace) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(`${storagePrefix}${shareId}`, JSON.stringify(workspace))
}

function buildLanguageOverview(files: AIImportedRepoFile[]) {
    const counts = new Map<string, number>()
    for (const file of files) {
        const language = languageForPath(file.path)
        counts.set(language, (counts.get(language) || 0) + 1)
    }

    const total = files.length || 1
    return [...counts.entries()]
        .map(([language, files]) => ({
            language,
            files,
            percentage: Math.round((files / total) * 100),
        }))
        .sort((left, right) => right.files - left.files)
        .slice(0, 8)
}

function languageForPath(filePath: string) {
    const name = filePath.split('/').pop()?.toLowerCase() || filePath.toLowerCase()
    if (name === 'dockerfile') return 'Dockerfile'
    if (name === 'makefile') return 'Makefile'
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'TypeScript'
    if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.mjs') || name.endsWith('.cjs')) return 'JavaScript'
    if (name.endsWith('.css') || name.endsWith('.scss') || name.endsWith('.sass')) return 'CSS'
    if (name.endsWith('.html')) return 'HTML'
    if (name.endsWith('.json')) return 'JSON'
    if (name.endsWith('.md') || name.endsWith('.mdx')) return 'Markdown'
    if (name.endsWith('.swift')) return 'Swift'
    if (name.endsWith('.py')) return 'Python'
    if (name.endsWith('.go')) return 'Go'
    if (name.endsWith('.rs')) return 'Rust'
    if (name.endsWith('.java') || name.endsWith('.kt') || name.endsWith('.kts')) return 'JVM'
    if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'YAML'
    if (name.endsWith('.sql')) return 'SQL'
    if (name.endsWith('.sh') || name.endsWith('.zsh') || name.endsWith('.bash')) return 'Shell'
    return 'Other'
}

function formatEta(progress: AISyncProgress, startedAt: number | null) {
    if (!startedAt || progress.syncedFiles <= 0 || progress.totalFiles <= progress.syncedFiles) {
        return progress.totalFiles <= progress.syncedFiles && progress.totalFiles > 0 ? 'Done' : 'ETA calculating'
    }

    const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.1)
    const secondsPerFile = elapsedSeconds / progress.syncedFiles
    const remainingSeconds = Math.max(0, Math.round(secondsPerFile * (progress.totalFiles - progress.syncedFiles)))

    if (remainingSeconds < 60) {
        return `${remainingSeconds}s left`
    }

    const minutes = Math.floor(remainingSeconds / 60)
    const seconds = remainingSeconds % 60
    return `${minutes}m ${seconds}s left`
}

function formatSyncTime(value?: string) {
    if (!value) return 'never'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'never'

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}
