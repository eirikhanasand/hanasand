'use client'

import Link from 'next/link'
import { Bot, ChevronRight, Layers3, Sparkles } from 'lucide-react'
import ChatPane from '@/components/ai/chatPane'
import ChatSidebar from '@/components/ai/chatSidebar'
import WorkspacePane from '@/components/ai/workspacePane'
import useAiWorkbench from '@/components/ai/useAiWorkbench'

export default function AIPageClient({
    initialConversations,
    initialRepositories,
    initialShares,
    isAuthenticated,
}: {
    initialConversations: AIConversation[]
    initialRepositories: AIImportedRepo[]
    initialShares: Share[]
    isAuthenticated: boolean
}) {
    const ai = useAiWorkbench({
        initialConversations,
        initialRepositories,
        initialShares,
        isAuthenticated,
    })

    return (
        <div className='h-full w-full overflow-hidden'>
            <div className='flex h-full flex-col px-4 pb-4 pt-4 md:px-6 lg:px-8'>
                <div className='mb-4 flex shrink-0 items-center justify-between rounded-3xl bg-dark/45 px-5 py-4 outline outline-dark'>
                    <div className='flex min-w-0 items-center gap-4'>
                        <div className='rounded-2xl bg-[#fd8738]/12 p-3 text-[#fd8738] outline outline-[#fd8738]/20'>
                            <Sparkles className='h-5 w-5' />
                        </div>
                        <div className='min-w-0'>
                            <p className='text-[11px] uppercase tracking-[0.28em] text-bright/35'>Hanasand AI</p>
                            <div className='mt-1 flex flex-wrap items-center gap-2'>
                                <h1 className='text-2xl font-semibold text-bright/92'>Coding workspace</h1>
                                <span className='rounded-full bg-dark/40 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-bright/45 outline outline-dark'>
                                    {ai.isConnected ? `${ai.clients.length} live model${ai.clients.length === 1 ? '' : 's'}` : 'Waiting for models'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className='flex items-center gap-3 text-sm text-bright/45'>
                        <div className='hidden items-center gap-2 rounded-2xl bg-dark/30 px-3 py-2 outline outline-dark md:flex'>
                            <Bot className='h-4 w-4 text-[#fd8738]' />
                            {isAuthenticated ? `${initialShares.length} shares ready` : 'Sign in for private shares'}
                        </div>
                        <Link href='/dashboard' className='inline-flex items-center gap-2 rounded-2xl bg-dark/30 px-3 py-2 text-bright/70 outline outline-dark transition-colors hover:text-[#fd8738]'>
                            Full editor
                            <ChevronRight className='h-4 w-4' />
                        </Link>
                    </div>
                </div>

                <div className='grid min-h-0 flex-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]'>
                    <ChatSidebar
                        activeConversationId={ai.activeConversationId}
                        conversations={ai.filteredConversations}
                        isAuthenticated={ai.isAuthenticated}
                        participants={ai.participants}
                        search={ai.search}
                        setSearch={ai.setSearch}
                        onNewConversation={ai.createNewConversation}
                        onSelectConversation={ai.selectConversation}
                    />
                    <ChatPane
                        activeConversation={ai.activeConversation}
                        clients={ai.clients}
                        composer={ai.composer}
                        isConnected={ai.isConnected}
                        onComposerChange={ai.setComposer}
                        onModelStrategyChange={ai.setModelStrategy}
                        onPreferredModelChange={ai.setPreferredModel}
                        onSend={ai.sendPrompt}
                    />
                    <WorkspacePane
                        activeConversation={ai.activeConversation}
                        importedRepos={ai.importedRepos}
                        importInput={ai.importInput}
                        importError={ai.importError}
                        importPending={ai.importPending}
                        initialShares={ai.initialShares}
                        syncingRepoId={ai.syncingRepoId}
                        selectedRepoFilePath={ai.selectedRepoFilePath}
                        selectedShareContent={ai.selectedShareContent}
                        onAttachRepo={ai.attachRepo}
                        onAttachShare={ai.attachShare}
                        onImportInputChange={ai.setImportInput}
                        onImportRepo={ai.importRepo}
                        onRefreshRepo={ai.refreshRepo}
                        onSelectRepoFile={ai.selectRepoFile}
                    />
                </div>
                {!ai.filteredConversations.length ? (
                    <div className='mt-4 rounded-3xl bg-dark/35 p-5 outline outline-dark'>
                        <div className='flex flex-wrap items-start gap-4'>
                            <div className='rounded-2xl bg-[#fd8738]/12 p-3 text-[#fd8738] outline outline-[#fd8738]/20'>
                                <Layers3 className='h-5 w-5' />
                            </div>
                            <div className='max-w-4xl'>
                                <h2 className='text-lg font-semibold text-bright/92'>Start in the app, not on a promo page</h2>
                                <p className='mt-2 text-sm leading-6 text-bright/48'>
                                    Create a chat, attach a share or imported repo, choose a model, and keep building. Completed chats persist in the workspace so another connected model can pick up where the last one left off.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
