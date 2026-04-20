'use client'

import { Database, ExternalLink, FileCode2, FolderGit2, Globe, Link2, Lock, RefreshCcw, Share2 } from 'lucide-react'

type WorkspacePaneProps = {
    activeConversation: AIConversation | null
    importedRepos: AIImportedRepo[]
    importInput: string
    importError: string | null
    importPending: boolean
    initialShares: Share[]
    syncingRepoId: string | null
    selectedRepoFilePath: string | null
    selectedShareContent: string | null
    onAttachRepo: (repoId: string) => void
    onAttachShare: (shareId: string) => void
    onImportInputChange: (value: string) => void
    onImportRepo: () => void
    onRefreshRepo: (repoId: string) => void
    onSelectRepoFile: (path: string) => void
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
        selectedRepoFilePath,
        selectedShareContent,
        onAttachRepo,
        onAttachShare,
        onImportInputChange,
        onImportRepo,
        onRefreshRepo,
        onSelectRepoFile,
    } = props

    const attachedShareIds = new Set(activeConversation?.shareIds || [])
    const repositoryId = typeof activeConversation?.workspaceMeta?.repositoryId === 'string'
        ? activeConversation.workspaceMeta.repositoryId
        : null
    const activeRepo = repositoryId ? importedRepos.find((repo) => repo.id === repositoryId) || null : null
    const selectedFile = activeRepo?.files.find((file) => file.path === selectedRepoFilePath) || activeRepo?.files[0] || null

    return (
        <aside className='flex min-h-0 flex-col gap-3'>
            <section className='grid gap-2 text-xs text-bright/40'>
                <StatusRow icon={<Share2 className='h-3.5 w-3.5' />} label={`${attachedShareIds.size} share${attachedShareIds.size === 1 ? '' : 's'} attached`} />
                <StatusRow icon={<FolderGit2 className='h-3.5 w-3.5' />} label={activeRepo ? `${activeRepo.fullName} active` : 'No repository focused'} />
                <StatusRow icon={<Globe className='h-3.5 w-3.5' />} label='HTTP tools available for signed-in requests' />
            </section>

            <section className='rounded-2xl bg-dark/25 p-4 outline outline-dark'>
                <div className='flex items-center justify-between gap-3'>
                    <div>
                        <p className='text-[11px] uppercase tracking-[0.22em] text-bright/35'>Import repo</p>
                        <h3 className='mt-1 text-sm font-semibold text-bright/88'>Bring GitHub into the app</h3>
                    </div>
                    <FolderGit2 className='h-4 w-4 text-[#fd8738]' />
                </div>
                <div className='mt-3 space-y-2'>
                    <input
                        value={importInput}
                        onChange={(event) => onImportInputChange(event.target.value)}
                        placeholder='owner/repo, owner/repo#branch:subdir, or GitHub tree URL'
                        className='w-full rounded-xl bg-dark/40 px-3 py-2.5 text-sm text-bright/88 outline outline-dark placeholder:text-bright/25'
                    />
                    <button
                        type='button'
                        onClick={onImportRepo}
                        disabled={importPending}
                        className='inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#fd8738] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                        <Link2 className='h-4 w-4' />
                        {importPending ? 'Importing...' : 'Import repository'}
                    </button>
                </div>
                {importError ? <p className='mt-3 text-sm text-red-300'>{importError}</p> : null}
            </section>

            <section className='min-h-0 rounded-2xl bg-dark/25 p-4 outline outline-dark'>
                <div className='mb-3 flex items-center justify-between gap-3'>
                    <div>
                        <p className='text-[11px] uppercase tracking-[0.22em] text-bright/35'>Attached shares</p>
                        <h3 className='mt-1 text-sm font-semibold text-bright/88'>Choose what the assistant can edit</h3>
                    </div>
                    <Database className='h-4 w-4 text-[#fd8738]' />
                </div>
                <div className='max-h-40 space-y-2 overflow-y-auto pr-1'>
                    {initialShares.length ? initialShares.map((share) => {
                        const isAttached = attachedShareIds.has(share.id)
                        return (
                            <button
                                key={share.id}
                                type='button'
                                onClick={() => onAttachShare(share.id)}
                                className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-3 text-left outline transition-colors ${isAttached ? 'bg-[#fd8738]/12 outline-[#fd8738]/20' : 'bg-dark/35 outline-dark hover:bg-dark/45'}`}
                            >
                                <div className='min-w-0'>
                                    <p className='truncate text-sm font-medium text-bright/88'>{share.alias || share.path}</p>
                                    <p className='mt-1 truncate text-xs text-bright/35'>{share.path}</p>
                                </div>
                                {share.locked ? <Lock className='h-4 w-4 shrink-0 text-bright/35' /> : <Share2 className='h-4 w-4 shrink-0 text-[#fd8738]' />}
                            </button>
                        )
                    }) : (
                        <EmptyPanel text='No shares available yet. Create one from the editor or import a repository to seed the workspace.' />
                    )}
                </div>
            </section>

            <section className='min-h-0 flex-1 rounded-2xl bg-dark/25 p-4 outline outline-dark'>
                <div className='mb-3 flex items-center justify-between gap-3'>
                    <div>
                        <p className='text-[11px] uppercase tracking-[0.22em] text-bright/35'>Repository context</p>
                        <h3 className='mt-1 text-sm font-semibold text-bright/88'>Imported repos and focused file</h3>
                    </div>
                    <FileCode2 className='h-4 w-4 text-[#fd8738]' />
                </div>

                {importedRepos.length ? (
                    <div className='grid min-h-0 gap-3 xl:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]'>
                        <div className='max-h-64 space-y-2 overflow-y-auto pr-1 xl:max-h-none'>
                            {importedRepos.map((repo) => {
                                const isActive = repo.id === activeRepo?.id
                                return (
                                    <button
                                        key={repo.id}
                                        type='button'
                                        onClick={() => onAttachRepo(repo.id)}
                                        className={`w-full cursor-pointer rounded-xl px-3 py-3 text-left outline transition-colors ${isActive ? 'bg-[#fd8738]/12 outline-[#fd8738]/20' : 'bg-dark/35 outline-dark hover:bg-dark/45'}`}
                                    >
                                        <p className='truncate text-sm font-medium text-bright/88'>{repo.name}</p>
                                        <p className='mt-1 truncate text-xs text-bright/35'>{repo.branch}{repo.sourcePath ? ` • ${repo.sourcePath}` : ''}</p>
                                    </button>
                                )
                            })}
                        </div>
                        <div className='min-h-0 rounded-xl bg-dark/35 p-3 outline outline-dark'>
                            {activeRepo ? (
                                <div className='flex h-full min-h-64 flex-col gap-3'>
                                    <div className='flex items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <p className='truncate text-sm font-semibold text-bright/88'>{activeRepo.fullName}</p>
                                            <p className='mt-1 text-xs text-bright/35'>{activeRepo.files.length} files imported{activeRepo.truncated ? ' • capped for performance' : ''}</p>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <a href={activeRepo.sourceUrl} target='_blank' rel='noreferrer' className='rounded-lg bg-dark/45 p-2 text-bright/45 outline outline-dark transition-colors hover:text-[#fd8738]'>
                                                <ExternalLink className='h-4 w-4' />
                                            </a>
                                            <button
                                                type='button'
                                                onClick={() => onRefreshRepo(activeRepo.id)}
                                                disabled={syncingRepoId === activeRepo.id}
                                                className='rounded-lg bg-dark/45 p-2 text-bright/55 outline outline-dark transition-colors hover:text-[#fd8738] disabled:cursor-not-allowed disabled:opacity-50'
                                            >
                                                <RefreshCcw className={`h-4 w-4 ${syncingRepoId === activeRepo.id ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className='grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]'>
                                        <div className='max-h-56 space-y-1 overflow-y-auto pr-1 md:max-h-none'>
                                            {activeRepo.files.slice(0, 120).map((file) => (
                                                <button
                                                    key={file.path}
                                                    type='button'
                                                    onClick={() => onSelectRepoFile(file.path)}
                                                    className={`block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left text-xs outline transition-colors ${selectedFile?.path === file.path ? 'bg-[#fd8738]/12 text-bright/88 outline-[#fd8738]/20' : 'bg-dark/40 text-bright/55 outline-transparent hover:bg-dark/55'}`}
                                                >
                                                    {file.path}
                                                </button>
                                            ))}
                                        </div>
                                        <pre className='min-h-56 overflow-auto rounded-lg bg-black/30 p-3 text-xs leading-6 text-bright/78 outline outline-dark'>{selectedFile?.content || 'Select a file to preview repository context.'}</pre>
                                    </div>
                                </div>
                            ) : (
                                <EmptyPanel text='Attach one of the imported repositories to let Hanasand AI work with a focused file tree.' />
                            )}
                        </div>
                    </div>
                ) : (
                    <EmptyPanel text='No repositories imported yet. Paste a GitHub URL above to seed the coding workspace.' />
                )}
            </section>

            <section className='rounded-2xl bg-dark/25 p-4 outline outline-dark'>
                <div className='flex items-center justify-between gap-3'>
                    <div>
                        <p className='text-[11px] uppercase tracking-[0.22em] text-bright/35'>Active share preview</p>
                        <h3 className='mt-1 text-sm font-semibold text-bright/88'>Current editable content</h3>
                    </div>
                    <Share2 className='h-4 w-4 text-[#fd8738]' />
                </div>
                <pre className='mt-3 max-h-56 overflow-auto rounded-xl bg-black/30 p-3 text-xs leading-6 text-bright/72 outline outline-dark'>
                    {selectedShareContent || 'Attach a share to preview the live content available to Hanasand AI.'}
                </pre>
            </section>
        </aside>
    )
}

function StatusRow({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className='flex items-center gap-2 rounded-xl bg-dark/35 px-3 py-2 outline outline-dark'>
            <span className='text-[#fd8738]'>{icon}</span>
            <span>{label}</span>
        </div>
    )
}

function EmptyPanel({ text }: { text: string }) {
    return (
        <div className='rounded-xl bg-dark/35 p-4 text-sm leading-6 text-bright/45 outline outline-dark'>
            {text}
        </div>
    )
}
