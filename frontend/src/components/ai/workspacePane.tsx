'use client'

import { useState } from 'react'
import { listTreePaths } from './shareTree'

type WorkspacePaneProps = {
    activeConversation: AIConversation | null
    importedRepos: AIImportedRepo[]
    importInput: string
    importError: string | null
    importPending: boolean
    initialShares: Share[]
    syncingRepoId: string | null
    activeShareTree: Tree | null
    selectedRepoFilePath: string | null
    selectedShareFileContent: string | null
    selectedShareContent: string | null
    onAttachRepo: (repoId: string) => void | Promise<void>
    onAttachShare: (shareId: string) => void | Promise<void>
    onImportInputChange: (value: string) => void
    onImportRepo: () => void | Promise<void>
    onRefreshRepo: (repoId: string) => void | Promise<void>
    onScaffoldStarter: (template: 'nextjs_docker', projectName?: string | null) => void | Promise<void>
    onSelectRepoFile: (path: string) => void | Promise<void>
    onSelectShareFile: (path: string) => void | Promise<void>
}

export default function WorkspacePane(props: WorkspacePaneProps) {
    const {
        activeConversation,
        importedRepos,
        importInput,
        importError,
        importPending,
        initialShares,
        syncingRepoId,
        activeShareTree,
        selectedRepoFilePath,
        selectedShareFileContent,
        selectedShareContent,
        onAttachRepo,
        onAttachShare,
        onImportInputChange,
        onImportRepo,
        onRefreshRepo,
        onScaffoldStarter,
        onSelectRepoFile,
        onSelectShareFile,
    } = props
    const [starterName, setStarterName] = useState('')

    const activeRepoId = typeof activeConversation?.workspaceMeta?.repositoryId === 'string'
        ? activeConversation.workspaceMeta.repositoryId
        : activeConversation?.workspaceKind === 'repo'
            ? activeConversation.workspaceId
            : null

    const activeRepo = activeRepoId ? importedRepos.find((repo) => repo.id === activeRepoId) || null : null
    const activeShare = initialShares.find((share) => share.id === activeConversation?.workspaceId) || null
    const activeTreePaths = listTreePaths(activeShareTree)
    const selectedPath = typeof activeConversation?.workspaceMeta?.selectedFilePath === 'string'
        ? activeConversation.workspaceMeta.selectedFilePath
        : null
    const selectedContent = selectedShareFileContent || selectedShareContent
    const selectedLabel = selectedPath || activeShare?.alias || activeShare?.path || activeConversation?.workspaceId || null

    return (
        <div className='grid gap-3'>
            <section className='rounded-2xl bg-dark/30 p-3 outline outline-dark'>
                <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>Active workspace</div>
                <div className='mt-3 grid gap-2'>
                    <WorkspaceStat
                        label='Mode'
                        value={activeConversation?.workspaceKind === 'repo' ? 'Repository workspace' : activeConversation?.workspaceKind === 'share' ? 'Share workspace' : 'No workspace attached'}
                    />
                    <WorkspaceStat
                        label='Source'
                        value={activeRepo?.fullName || activeShare?.alias || activeShare?.path || activeConversation?.workspaceId || 'Attach a repo or share'}
                    />
                    <WorkspaceStat
                        label='Focus'
                        value={selectedPath || 'Select a file to inspect it here'}
                    />
                    <WorkspaceStat
                        label='Attached shares'
                        value={`${activeConversation?.shareIds?.length || 0}`}
                    />
                </div>
            </section>

            <section className='rounded-2xl bg-dark/30 p-3 outline outline-dark'>
                <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>Import repo</div>
                <div className='mt-2 flex gap-2'>
                    <input value={importInput} onChange={(event) => onImportInputChange(event.target.value)} placeholder='owner/repo or GitHub URL' className='min-w-0 flex-1 rounded-xl bg-dark/40 px-3 py-2 text-sm text-bright/90 outline outline-dark placeholder:text-bright/24' />
                    <button type='button' onClick={() => void onImportRepo()} disabled={importPending} className='rounded-xl bg-[#fd8738] px-3 py-2 text-sm font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-60'>
                        {importPending ? 'Importing' : 'Import'}
                    </button>
                </div>
                {importError ? <div className='mt-2 text-sm text-red-300'>{importError}</div> : null}
            </section>

            <section className='rounded-2xl bg-dark/30 p-3 outline outline-dark'>
                <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>Starters</div>
                <div className='mt-2 grid gap-2'>
                    <input
                        value={starterName}
                        onChange={(event) => setStarterName(event.target.value)}
                        placeholder='Project name'
                        className='min-w-0 rounded-xl bg-dark/40 px-3 py-2 text-sm text-bright/90 outline outline-dark placeholder:text-bright/24'
                    />
                    <button
                        type='button'
                        onClick={() => void onScaffoldStarter('nextjs_docker', starterName)}
                        className='rounded-xl bg-[#fd8738] px-3 py-2 text-sm font-semibold text-black transition-opacity'
                    >
                        New Next.js + Docker workspace
                    </button>
                    <div className='text-xs leading-5 text-bright/42'>
                        Creates a multi-file Next.js App Router project with TypeScript, Dockerfile, docker-compose, and a starter landing page.
                    </div>
                </div>
            </section>

            <section className='rounded-2xl bg-dark/30 p-3 outline outline-dark'>
                <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>Repositories</div>
                <div className='mt-3 grid gap-2'>
                    {importedRepos.length ? importedRepos.map((repo) => (
                        <div key={repo.id} className={`rounded-xl px-3 py-3 outline ${repo.id === activeRepoId ? 'bg-[#fd8738]/10 outline-[#fd8738]/18' : 'bg-dark/35 outline-dark'}`}>
                            <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm font-medium text-bright/90'>{repo.fullName}</div>
                                    <div className='mt-1 text-xs text-bright/35'>{repo.branch}</div>
                                </div>
                                <div className='flex gap-2'>
                                    <button type='button' onClick={() => void onAttachRepo(repo.id)} className='rounded-lg bg-dark/40 px-2.5 py-1.5 text-xs text-bright/80 outline outline-dark hover:text-[#fd8738]'>
                                        Attach
                                    </button>
                                    <button type='button' onClick={() => void onRefreshRepo(repo.id)} className='rounded-lg bg-dark/40 px-2.5 py-1.5 text-xs text-bright/80 outline outline-dark hover:text-[#fd8738]'>
                                        {syncingRepoId === repo.id ? 'Syncing' : 'Refresh'}
                                    </button>
                                </div>
                            </div>
                            {repo.id === activeRepoId && repo.files.length ? (
                                <div className='mt-3 max-h-40 space-y-1 overflow-y-auto pr-1'>
                                    {repo.files.slice(0, 80).map((file) => (
                                        <button key={file.path} type='button' onClick={() => void onSelectRepoFile(file.path)} className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selectedRepoFilePath === file.path ? 'bg-[#fd8738]/12 text-bright/90 outline-[#fd8738]/18' : 'bg-dark/30 text-bright/65 outline-transparent hover:outline-dark'}`}>
                                            {file.path}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    )) : (
                        <div className='rounded-xl bg-dark/35 px-3 py-4 text-sm text-bright/40 outline outline-dark'>
                            No repositories imported yet.
                        </div>
                    )}
                </div>
            </section>

            <section className='rounded-2xl bg-dark/30 p-3 outline outline-dark'>
                <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>Shares</div>
                <div className='mt-3 grid gap-2'>
                    {initialShares.length ? initialShares.slice(0, 40).map((share) => (
                        <div key={share.id} className={`rounded-xl px-3 py-3 outline ${share.id === activeConversation?.workspaceId ? 'bg-[#fd8738]/10 outline-[#fd8738]/18' : 'bg-dark/35 outline-dark'}`}>
                            <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm text-bright/85'>{share.alias || share.id}</div>
                                    <div className='mt-1 truncate text-xs text-bright/35'>{share.path || share.id}</div>
                                </div>
                                <button type='button' onClick={() => void onAttachShare(share.id)} className='rounded-lg bg-dark/40 px-2.5 py-1.5 text-xs text-bright/80 outline outline-dark hover:text-[#fd8738]'>
                                    Attach
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className='rounded-xl bg-dark/35 px-3 py-4 text-sm text-bright/40 outline outline-dark'>
                            No shares available.
                        </div>
                    )}
                </div>
            </section>

            {activeConversation?.workspaceKind === 'share' && activeTreePaths.length ? (
                <section className='rounded-2xl bg-dark/30 p-3 outline outline-dark'>
                    <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>Share files</div>
                    <div className='mt-3 max-h-48 space-y-1 overflow-y-auto pr-1'>
                        {activeTreePaths.slice(0, 120).map((path) => (
                            <button
                                key={path}
                                type='button'
                                onClick={() => void onSelectShareFile(path)}
                                className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selectedPath === path ? 'bg-[#fd8738]/12 text-bright/90 outline-[#fd8738]/18' : 'bg-dark/30 text-bright/65 outline-transparent hover:outline-dark'}`}
                            >
                                {path}
                            </button>
                        ))}
                    </div>
                </section>
            ) : null}

            {selectedContent ? (
                <section className='rounded-2xl bg-dark/30 p-3 outline outline-dark'>
                    <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>Selected content</div>
                    {selectedLabel ? <div className='mt-2 truncate text-xs text-bright/42'>{selectedLabel}</div> : null}
                    <pre className='mt-3 max-h-72 overflow-auto rounded-xl bg-black/20 p-3 text-xs leading-5 text-bright/80'>{selectedContent.slice(0, 12000)}</pre>
                </section>
            ) : null}

            {activeRepo?.sourceUrl ? (
                <div className='text-xs text-bright/35'>
                    Source: <a className='text-[#fd8738]' href={activeRepo.sourceUrl} target='_blank' rel='noreferrer'>{activeRepo.sourceUrl}</a>
                </div>
            ) : null}
        </div>
    )
}

function WorkspaceStat({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-xl bg-dark/35 px-3 py-2 outline outline-dark'>
            <div className='text-[10px] uppercase tracking-[0.18em] text-bright/30'>{label}</div>
            <div className='mt-1 text-sm text-bright/82'>{value}</div>
        </div>
    )
}
