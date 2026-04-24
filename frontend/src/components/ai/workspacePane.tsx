'use client'

import { useState } from 'react'
import { FolderGit2, RefreshCcw, Rocket, Share2, TerminalSquare } from 'lucide-react'
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

    return (
        <aside className='flex h-full min-h-0 flex-col gap-3 rounded-2xl bg-dark/30 p-3 outline outline-dark'>
            <Panel
                icon={<TerminalSquare className='h-4 w-4' />}
                title='Workspace'
                subtitle={activeRepo?.fullName || activeShare?.alias || activeShare?.path || 'No workspace attached'}
            >
                <Stat label='Mode' value={activeConversation?.workspaceKind === 'repo' ? 'Repository' : activeConversation?.workspaceKind === 'share' ? 'Share' : 'Idle'} />
                <Stat label='Focus' value={selectedPath || 'No file selected'} />
                <Stat label='Shares' value={`${activeConversation?.shareIds?.length || 0} attached`} />
            </Panel>

            <Panel
                icon={<FolderGit2 className='h-4 w-4' />}
                title='Import from GitHub'
                subtitle='Pull a repository straight into a share-backed workspace.'
            >
                <div className='flex gap-2'>
                    <input value={importInput} onChange={(event) => onImportInputChange(event.target.value)} placeholder='owner/repo, URL, or repo#branch:path' className='min-w-0 flex-1 rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24' />
                    <button type='button' onClick={() => void onImportRepo()} disabled={importPending} className='rounded-xl bg-[#fd8738] px-3 py-2 text-sm font-semibold text-black transition-opacity disabled:opacity-60'>
                        {importPending ? 'Importing' : 'Import'}
                    </button>
                </div>
                {importError ? <div className='text-sm text-red-300'>{importError}</div> : null}
            </Panel>

            <Panel
                icon={<Rocket className='h-4 w-4' />}
                title='Starter'
                subtitle='Bootstrap a Docker-ready Next.js workspace from one prompt.'
            >
                <input value={starterName} onChange={(event) => setStarterName(event.target.value)} placeholder='Project name' className='rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24' />
                <button type='button' onClick={() => void onScaffoldStarter('nextjs_docker', starterName)} className='rounded-xl bg-[#fd8738] px-3 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90'>
                    Create Next.js + Docker workspace
                </button>
            </Panel>

            <Panel
                icon={<FolderGit2 className='h-4 w-4' />}
                title='Repositories'
                subtitle={`${importedRepos.length} imported`}
                grow
            >
                {importedRepos.length ? importedRepos.map((repo) => (
                    <div key={repo.id} className={`rounded-xl px-3 py-3 outline ${repo.id === activeRepoId ? 'bg-[#fd8738]/10 outline-[#fd8738]/18' : 'bg-dark/22 outline-dark'}`}>
                        <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                                <div className='truncate text-sm font-medium text-bright/88'>{repo.fullName}</div>
                                <div className='mt-1 text-xs text-bright/35'>
                                    {repo.branch} · {repo.syncStatus === 'ready' ? 'Ready' : repo.syncStatus === 'syncing' ? 'Syncing…' : repo.lastSyncError || 'Sync failed'}
                                </div>
                            </div>
                            <div className='flex items-center gap-2'>
                                <button type='button' onClick={() => void onAttachRepo(repo.id)} className='rounded-lg bg-dark/35 px-2.5 py-1.5 text-xs text-bright/80 outline outline-dark hover:text-[#fd8738]'>
                                    Attach
                                </button>
                                <button type='button' onClick={() => void onRefreshRepo(repo.id)} className='grid h-8 w-8 place-items-center rounded-lg bg-dark/35 text-bright/70 outline outline-dark hover:text-[#fd8738]'>
                                    <RefreshCcw className={`h-3.5 w-3.5 ${syncingRepoId === repo.id ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                        {repo.id === activeRepoId && repo.files.length ? (
                            <div className='mt-3 max-h-36 space-y-1 overflow-y-auto pr-1'>
                                {repo.files.slice(0, 80).map((file) => (
                                    <button key={file.path} type='button' onClick={() => void onSelectRepoFile(file.path)} className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selectedRepoFilePath === file.path ? 'bg-[#fd8738]/12 text-bright/90 outline-[#fd8738]/18' : 'bg-dark/30 text-bright/65 outline-transparent hover:outline-dark'}`}>
                                        {file.path}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                )) : <Empty text='No repositories imported yet.' />}
            </Panel>

            <Panel
                icon={<Share2 className='h-4 w-4' />}
                title='Shares'
                subtitle='Attach an existing Hanasand workspace.'
            >
                <div className='max-h-40 space-y-2 overflow-y-auto pr-1'>
                    {initialShares.length ? initialShares.slice(0, 40).map((share) => (
                        <div key={share.id} className={`rounded-xl px-3 py-3 outline ${share.id === activeConversation?.workspaceId ? 'bg-[#fd8738]/10 outline-[#fd8738]/18' : 'bg-dark/22 outline-dark'}`}>
                            <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm text-bright/85'>{share.alias || share.id}</div>
                                    <div className='mt-1 truncate text-xs text-bright/35'>{share.path || share.id}</div>
                                </div>
                                <button type='button' onClick={() => void onAttachShare(share.id)} className='rounded-lg bg-dark/35 px-2.5 py-1.5 text-xs text-bright/80 outline outline-dark hover:text-[#fd8738]'>
                                    Attach
                                </button>
                            </div>
                        </div>
                    )) : <Empty text='No shares available.' />}
                </div>
            </Panel>

            {activeConversation?.workspaceKind === 'share' && activeTreePaths.length ? (
                <Panel
                    icon={<FolderGit2 className='h-4 w-4' />}
                    title='Project files'
                    subtitle='Split-view file selector'
                >
                    <div className='max-h-40 space-y-1 overflow-y-auto pr-1'>
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
                </Panel>
            ) : null}

            {selectedContent ? (
                <Panel
                    icon={<TerminalSquare className='h-4 w-4' />}
                    title='Preview'
                    subtitle={selectedPath || 'Selected content'}
                    grow
                >
                    <pre className='max-h-72 overflow-auto rounded-xl bg-black/20 p-3 text-xs leading-5 text-bright/80'>{selectedContent.slice(0, 12000)}</pre>
                </Panel>
            ) : null}
        </aside>
    )
}

function Panel({
    icon,
    title,
    subtitle,
    children,
    grow = false,
}: {
    icon: React.ReactNode
    title: string
    subtitle: string
    children: React.ReactNode
    grow?: boolean
}) {
    return (
        <section className={`rounded-2xl bg-dark/22 p-3 outline outline-dark ${grow ? 'min-h-0 flex-1' : ''}`}>
            <div className='flex items-start gap-3'>
                <div className='mt-0.5 rounded-xl bg-[#fd8738]/12 p-2 text-[#fd8738] outline outline-[#fd8738]/18'>
                    {icon}
                </div>
                <div className='min-w-0'>
                    <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>{title}</div>
                    <div className='mt-1 text-sm text-bright/82'>{subtitle}</div>
                </div>
            </div>
            <div className={`mt-3 grid gap-2 ${grow ? 'min-h-0' : ''}`}>{children}</div>
        </section>
    )
}

function Stat({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-xl bg-dark/30 px-3 py-2 outline outline-dark'>
            <div className='text-[10px] uppercase tracking-[0.18em] text-bright/30'>{label}</div>
            <div className='mt-1 text-sm text-bright/82'>{value}</div>
        </div>
    )
}

function Empty({ text }: { text: string }) {
    return (
        <div className='rounded-xl bg-dark/30 px-3 py-4 text-sm text-bright/40 outline outline-dark'>
            {text}
        </div>
    )
}
