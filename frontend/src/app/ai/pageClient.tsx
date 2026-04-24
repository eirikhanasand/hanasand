'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bot, FolderKanban, PanelRight, SquareArrowOutUpRight } from 'lucide-react'
import ChatPane from '@/components/ai/chatPane'
import ChatSidebar from '@/components/ai/chatSidebar'
import WorkspacePane from '@/components/ai/workspacePane'
import useAiWorkbench from '@/components/ai/useAiWorkbench'

type AIPageMode = 'landing' | 'workspace' | 'compact'

export default function AIPageClient({
    initialConversations,
    initialRepositories,
    initialShares,
    isAuthenticated,
    compact = false,
    mode = 'landing',
    initialConversationId = null,
}: {
    initialConversations: AIConversation[]
    initialRepositories: AIImportedRepo[]
    initialShares: Share[]
    isAuthenticated: boolean
    compact?: boolean
    mode?: AIPageMode
    initialConversationId?: string | null
}) {
    const router = useRouter()
    const pathname = usePathname()
    const ai = useAiWorkbench({
        initialConversations,
        initialRepositories,
        initialShares,
        isAuthenticated,
        initialConversationId,
    })
    const [detailsOpen, setDetailsOpen] = useState(mode !== 'landing')
    const showWorkspaceRail = mode !== 'landing'
    const showHeader = mode === 'workspace'

    function selectConversation(id: string) {
        ai.selectConversation(id)
        if (mode === 'workspace' && pathname !== `/ai/${id}`) {
            router.push(`/ai/${id}`)
        }
    }

    return (
        <div className={`${compact ? 'h-screen' : 'h-[calc(100vh-4.5rem)]'} w-full overflow-hidden`}>
            <div className={`flex h-full flex-col ${compact ? 'px-3 pb-3 pt-3' : 'px-4 pb-5 pt-6 md:px-6 lg:px-8 lg:pt-8'}`}>
                {showHeader ? (
                    <div className='mb-4 flex items-center justify-between rounded-2xl bg-dark/30 px-4 py-3 outline outline-dark'>
                        <div className='min-w-0'>
                            <div className='flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-bright/35'>
                                <Bot className='h-3.5 w-3.5 text-[#fd8738]' />
                                Hanasand AI Workspace
                            </div>
                            <h1 className='mt-2 truncate text-lg font-semibold text-bright/92'>
                                {ai.activeConversation?.title || 'Workspace'}
                            </h1>
                        </div>
                        <div className='flex items-center gap-2'>
                            <button
                                type='button'
                                onClick={() => setDetailsOpen((prev) => !prev)}
                                className={`grid h-10 w-10 place-items-center rounded-xl outline transition-colors ${detailsOpen ? 'bg-[#fd8738]/12 text-[#fd8738] outline-[#fd8738]/20' : 'bg-dark/30 text-bright/55 outline-dark hover:text-bright/85'}`}
                            >
                                <PanelRight className='h-4 w-4' />
                            </button>
                            <Link href={ai.activeConversation?.workspaceId ? `/s/${ai.activeConversation.workspaceId}` : '/s'} className='inline-flex items-center gap-2 rounded-xl bg-dark/30 px-3 py-2 text-sm text-bright/72 outline outline-dark transition-colors hover:text-[#fd8738]'>
                                Editor
                                <SquareArrowOutUpRight className='h-4 w-4' />
                            </Link>
                        </div>
                    </div>
                ) : null}

                <div className={`grid min-h-0 flex-1 gap-4 ${showWorkspaceRail && detailsOpen ? 'xl:grid-cols-[17rem_minmax(0,1fr)_24rem]' : 'xl:grid-cols-[17rem_minmax(0,1fr)]'}`}>
                    <ChatSidebar
                        activeConversation={ai.activeConversation}
                        activeConversationId={ai.activeConversationId}
                        archivedConversations={ai.archivedConversations}
                        conversations={ai.filteredConversations}
                        isAuthenticated={ai.isAuthenticated}
                        search={ai.search}
                        setSearch={ai.setSearch}
                        onArchiveConversation={ai.archiveConversation}
                        onDeleteConversation={ai.deleteConversation}
                        onNewConversation={ai.createNewConversation}
                        onRenameConversation={ai.renameConversation}
                        onSelectConversation={selectConversation}
                    />

                    <ChatPane
                        activeConversation={ai.activeConversation}
                        clients={ai.clients}
                        composer={ai.composer}
                        isConnected={ai.isConnected}
                        participants={ai.participants}
                        landing={mode === 'landing'}
                        onComposerChange={ai.setComposer}
                        onModelStrategyChange={ai.setModelStrategy}
                        onPreferredModelChange={ai.setPreferredModel}
                        onSend={ai.sendPrompt}
                    />

                    {showWorkspaceRail && detailsOpen ? (
                        <div className='min-h-0'>
                            <WorkspacePane
                                activeConversation={ai.activeConversation}
                                importedRepos={ai.importedRepos}
                                importInput={ai.importInput}
                                importError={ai.importError}
                                importPending={ai.importPending}
                                initialShares={ai.initialShares}
                                syncingRepoId={ai.syncingRepoId}
                                activeShareTree={ai.activeShareTree}
                                selectedRepoFilePath={ai.selectedRepoFilePath}
                                selectedShareFileContent={ai.selectedShareFileContent}
                                selectedShareContent={ai.selectedShareContent}
                                onAttachRepo={ai.attachRepo}
                                onAttachShare={ai.attachShare}
                                onImportInputChange={ai.setImportInput}
                                onImportRepo={ai.importRepo}
                                onRefreshRepo={ai.refreshRepo}
                                onScaffoldStarter={ai.scaffoldStarter}
                                onSelectRepoFile={ai.selectRepoFile}
                                onSelectShareFile={ai.selectShareFile}
                            />
                        </div>
                    ) : null}
                </div>

                {ai.statusNotice ? (
                    <div className='mt-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100 outline outline-amber-500/20'>
                        {ai.statusNotice}
                    </div>
                ) : null}

                {mode === 'landing' && !ai.filteredConversations.length && !ai.archivedConversations.length ? (
                    <div className='mt-4 flex justify-center'>
                        <div className='inline-flex items-center gap-2 rounded-full bg-dark/30 px-4 py-2 text-sm text-bright/48 outline outline-dark'>
                            <FolderKanban className='h-4 w-4 text-[#fd8738]' />
                            Import a repo or attach a share from a chat once you need workspace context.
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
