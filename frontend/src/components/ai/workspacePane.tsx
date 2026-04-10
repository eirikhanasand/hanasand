'use client'

import { ExternalLink, FileCode2, FolderGit2, Github, Link2 } from 'lucide-react'

type WorkspacePaneProps = {
    activeConversation: AIConversation | null
    importedRepos: AIImportedRepo[]
    importInput: string
    importError: string | null
    importPending: boolean
    initialShares: Share[]
    selectedRepoFilePath: string | null
    selectedShareContent: string | null
    onAttachRepo: (repoId: string) => void
    onAttachShare: (shareId: string) => void
    onImportInputChange: (value: string) => void
    onImportRepo: () => void
    onSelectRepoFile: (path: string) => void
}

export default function WorkspacePane({
    activeConversation,
    importedRepos,
    importInput,
    importError,
    importPending,
    initialShares,
    selectedRepoFilePath,
    selectedShareContent,
    onAttachRepo,
    onAttachShare,
    onImportInputChange,
    onImportRepo,
    onSelectRepoFile,
}: WorkspacePaneProps) {
    const activeRepo = activeConversation?.workspaceKind === 'repo'
        ? importedRepos.find((repo) => repo.id === activeConversation.workspaceId) || null
        : null
    const selectedRepoFile = activeRepo?.files.find((file) => file.path === selectedRepoFilePath) || activeRepo?.files[0] || null
    const activeShare = activeConversation?.workspaceKind === 'share'
        ? initialShares.find((share) => share.id === activeConversation.workspaceId) || null
        : null

    return (
        <aside className='flex h-full w-md flex-col gap-4 rounded-2xl bg-dark/35 p-4 outline outline-dark'>
            <section className='rounded-xl bg-dark/25 p-4 outline outline-dark'>
                <div className='flex items-center gap-2 text-[#fd8738]'>
                    <Github className='h-4 w-4' />
                    <h2 className='text-sm font-semibold uppercase tracking-[0.18em]'>Import GitHub repo</h2>
                </div>
                <div className='mt-3 space-y-3'>
                    <input
                        value={importInput}
                        onChange={(event) => onImportInputChange(event.target.value)}
                        placeholder='owner/repo or https://github.com/owner/repo'
                        className='w-full rounded-xl bg-dark/40 px-3 py-2.5 text-sm text-bright/90 outline outline-dark placeholder:text-bright/25'
                    />
                    <button
                        type='button'
                        disabled={importPending}
                        onClick={onImportRepo}
                        className='w-full rounded-xl bg-[#fd8738] px-4 py-2.5 font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50'
                    >
                        {importPending ? 'Importing...' : 'Import repository'}
                    </button>
                    {importError ? <p className='text-sm text-red-300'>{importError}</p> : null}
                </div>
            </section>

            <section className='grid min-h-0 flex-1 gap-4 overflow-hidden'>
                <div className='rounded-xl bg-dark/25 p-4 outline outline-dark'>
                    <div className='flex items-center gap-2 text-[#fd8738]'>
                        <Link2 className='h-4 w-4' />
                        <h2 className='text-sm font-semibold uppercase tracking-[0.18em]'>Shares</h2>
                    </div>
                    <div className='mt-3 max-h-44 space-y-2 overflow-y-auto'>
                        {initialShares.map((share) => (
                            <button
                                key={share.id}
                                type='button'
                                onClick={() => onAttachShare(share.id)}
                                className={`w-full rounded-xl p-3 text-left outline ${
                                    activeConversation?.workspaceKind === 'share' && activeConversation.workspaceId === share.id
                                        ? 'bg-[#fd8738]/12 outline-[#fd8738]/20'
                                        : 'bg-dark/30 outline-dark hover:bg-dark/45'
                                }`}
                            >
                                <div className='truncate text-sm font-semibold text-bright/90'>{share.path || share.alias || share.id}</div>
                                <div className='mt-1 truncate text-xs text-bright/35'>{share.id}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className='min-h-0 rounded-xl bg-dark/25 p-4 outline outline-dark'>
                    <div className='flex items-center gap-2 text-[#fd8738]'>
                        <FolderGit2 className='h-4 w-4' />
                        <h2 className='text-sm font-semibold uppercase tracking-[0.18em]'>Workspace</h2>
                    </div>
                    {!activeConversation?.workspaceId ? (
                        <p className='mt-3 text-sm text-bright/40'>Attach a share or imported repository to use the AI as a coding workspace.</p>
                    ) : activeRepo ? (
                        <div className='mt-3 grid min-h-0 gap-3 lg:grid-cols-[12rem_minmax(0,1fr)]'>
                            <div className='max-h-128 space-y-1 overflow-y-auto rounded-xl bg-dark/30 p-2 outline outline-dark'>
                                {activeRepo.files.map((file) => (
                                    <button
                                        key={file.path}
                                        type='button'
                                        onClick={() => onSelectRepoFile(file.path)}
                                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                                            selectedRepoFile?.path === file.path ? 'bg-[#fd8738]/12 text-[#fd8738]' : 'text-bright/65 hover:bg-dark/45'
                                        }`}
                                    >
                                        <FileCode2 className='h-3.5 w-3.5 shrink-0' />
                                        <span className='truncate'>{file.path}</span>
                                    </button>
                                ))}
                            </div>
                            <div className='min-h-80 rounded-xl bg-dark/30 p-3 outline outline-dark'>
                                <div className='mb-2 flex items-center justify-between gap-2'>
                                    <div>
                                        <h3 className='text-sm font-semibold text-bright/90'>{activeRepo.fullName}</h3>
                                        <p className='text-xs text-bright/35'>{selectedRepoFile?.path || 'No file selected'}</p>
                                    </div>
                                    <a href={activeRepo.sourceUrl} target='_blank' rel='noreferrer' className='text-bright/45 hover:text-[#fd8738]'>
                                        <ExternalLink className='h-4 w-4' />
                                    </a>
                                </div>
                                <pre className='max-h-112 overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-bright/75'>
                                    {selectedRepoFile?.content || 'No file content available.'}
                                </pre>
                            </div>
                        </div>
                    ) : activeShare ? (
                        <div className='mt-3 space-y-3'>
                            <div className='rounded-xl bg-dark/30 p-3 outline outline-dark'>
                                <h3 className='text-sm font-semibold text-bright/90'>{activeShare.path || activeShare.alias || activeShare.id}</h3>
                                <p className='mt-1 text-xs text-bright/35'>Live share workspace</p>
                            </div>
                            <iframe
                                src={`/s/${activeShare.id}`}
                                className='h-120 w-full rounded-xl bg-black outline outline-dark'
                                title={`Workspace ${activeShare.id}`}
                            />
                            <div className='rounded-xl bg-dark/30 p-3 outline outline-dark'>
                                <div className='mb-2 text-xs uppercase tracking-[0.18em] text-bright/35'>Share context</div>
                                <pre className='max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-bright/70'>
                                    {selectedShareContent || 'Loading share content...'}
                                </pre>
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>
        </aside>
    )
}
