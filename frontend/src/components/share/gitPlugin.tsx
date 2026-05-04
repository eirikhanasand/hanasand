'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { GitBranch, GitPullRequestArrow, LoaderCircle, LockKeyhole, RotateCcw } from 'lucide-react'
import { attachGitHubCredential, importGitHubRepository, persistGitHubRepository } from '@/components/ai/github'
import { importRepositoryToShare } from '@/utils/ai/importRepositoryToShare'
import { syncRepositoryToShare } from '@/utils/ai/syncRepositoryToShare'
import { getCookie } from '@/utils/cookies/cookies'

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
}

const storagePrefix = 'hanasand.share.git.'

export default function GitPlugin({ shareRouteId, share }: GitPluginProps) {
    const [input, setInput] = useState('')
    const [githubToken, setGitHubToken] = useState('')
    const [status, setStatus] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState<'import' | 'pull' | null>(null)
    const [stored, setStored] = useState<StoredGitWorkspace | null>(null)
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
        if (storedWorkspace?.input) {
            setInput(storedWorkspace.input)
        } else if (share?.git) {
            setInput(share.git)
        }
    }, [share?.git, shareRouteId])

    async function syncRepository(mode: 'import' | 'pull') {
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
        setStatus(mode === 'pull' ? 'Pulling the latest repository files...' : 'Loading repository into this workspace...')

        try {
            const existingId = mode === 'pull' ? share?.id || shareRouteId : undefined
            const repo = await importGitHubRepository(currentInput, existingId, githubToken)
            const persistedRepo = {
                ...repo,
                syncStatus: 'syncing' as const,
            }

            await persistGitHubRepository(persistedRepo)
            if (githubToken.trim()) {
                await attachGitHubCredential(repo.id, githubToken.trim())
            }

            if (mode === 'pull' && (share?.id || shareRouteId) === repo.id) {
                await syncRepositoryToShare({ repo: persistedRepo, token: accessToken, userId })
            } else {
                await importRepositoryToShare({ repo: persistedRepo, token: accessToken, userId })
            }

            const readyRepo = {
                ...persistedRepo,
                syncStatus: 'ready' as const,
                lastSyncedAt: new Date().toISOString(),
                lastSyncError: null,
            }
            await persistGitHubRepository(readyRepo)
            rememberGitWorkspace(repo.id, {
                input: repo.sourceUrl || currentInput,
                fullName: repo.fullName,
                branch: repo.branch,
                sourcePath: repo.sourcePath || '',
                updatedAt: new Date().toISOString(),
            })
            setStored(readStoredGitWorkspace(repo.id))
            setGitHubToken('')
            setStatus(mode === 'pull' ? 'Repository pulled into the editor.' : 'Repository loaded. Opening it now...')

            if (repo.id !== shareRouteId || mode === 'import') {
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
        }
    }

    return (
        <section className='rounded-lg bg-dark/35 p-3 outline outline-dark'>
            <div className='flex items-start gap-2'>
                <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fd8738]/12 text-[#fd8738] outline outline-[#fd8738]/18'>
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
                        className='inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#fd8738] px-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-55'
                    >
                        {pending === 'import' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitBranch className='h-3.5 w-3.5' />}
                        Load
                    </button>
                    <button
                        type='button'
                        onClick={() => void syncRepository('pull')}
                        disabled={!isSignedIn || Boolean(pending) || !currentInput}
                        className='inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-dark/45 px-2 text-xs font-semibold text-bright/82 outline outline-dark transition-colors hover:text-[#fd8738] disabled:opacity-55'
                    >
                        {pending === 'pull' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitPullRequestArrow className='h-3.5 w-3.5' />}
                        Pull
                    </button>
                </div>

                {stored ? (
                    <div className='rounded-lg bg-black/12 px-2.5 py-2 text-[11px] leading-4 text-bright/48 outline outline-dark'>
                        <div className='truncate text-bright/70'>{stored.fullName}</div>
                        <div className='mt-0.5 flex items-center gap-1.5'>
                            <RotateCcw className='h-3 w-3' />
                            {stored.branch}{stored.sourcePath ? ` / ${stored.sourcePath}` : ''}
                        </div>
                    </div>
                ) : null}
                {status ? <div className='text-[11px] leading-4 text-emerald-200/80'>{status}</div> : null}
                {error ? <div className='text-[11px] leading-4 text-red-300'>{error}</div> : null}
            </div>
        </section>
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
        }
    } catch {
        return null
    }
}

function rememberGitWorkspace(shareId: string, workspace: StoredGitWorkspace) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(`${storagePrefix}${shareId}`, JSON.stringify(workspace))
}
