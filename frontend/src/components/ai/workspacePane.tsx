'use client'

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
    onAttachRepo: (repoId: string) => void | Promise<void>
    onAttachShare: (shareId: string) => void | Promise<void>
    onImportInputChange: (value: string) => void
    onImportRepo: () => void | Promise<void>
    onRefreshRepo: (repoId: string) => void | Promise<void>
    onSelectRepoFile: (path: string) => void | Promise<void>
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

    const activeRepoId = typeof activeConversation?.workspaceMeta?.repositoryId === 'string'
        ? activeConversation.workspaceMeta.repositoryId
        : activeConversation?.workspaceKind === 'repo'
            ? activeConversation.workspaceId
            : null

    const activeRepo = activeRepoId ? importedRepos.find((repo) => repo.id === activeRepoId) || null : null

    return (
        <div className='grid gap-3'>
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
                        <button key={share.id} type='button' onClick={() => void onAttachShare(share.id)} className='rounded-xl bg-dark/35 px-3 py-2 text-left text-sm text-bright/75 outline outline-dark hover:text-[#fd8738]'>
                            {share.alias || share.id}
                        </button>
                    )) : (
                        <div className='rounded-xl bg-dark/35 px-3 py-4 text-sm text-bright/40 outline outline-dark'>
                            No shares available.
                        </div>
                    )}
                </div>
            </section>

            {selectedShareContent ? (
                <section className='rounded-2xl bg-dark/30 p-3 outline outline-dark'>
                    <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>Selected content</div>
                    <pre className='mt-3 max-h-56 overflow-auto rounded-xl bg-black/20 p-3 text-xs leading-5 text-bright/80'>{selectedShareContent.slice(0, 12000)}</pre>
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
