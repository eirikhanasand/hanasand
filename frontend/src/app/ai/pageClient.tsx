'use client'

import Link from 'next/link'
import { Bot, Sparkles } from 'lucide-react'
import ChatPane from '@/components/ai/chatPane'
import ChatSidebar from '@/components/ai/chatSidebar'
import WorkspacePane from '@/components/ai/workspacePane'
import useAiWorkbench from '@/components/ai/useAiWorkbench'

export default function AIPageClient({
    initialShares,
    isAuthenticated,
}: {
    initialShares: Share[]
    isAuthenticated: boolean
}) {
    const ai = useAiWorkbench(initialShares)

    return (
        <div className='h-full w-full overflow-y-auto'>
            <div className='mx-auto flex w-full max-w-560 flex-col gap-4 px-8 pb-6 pt-6 md:px-16 md:pt-8 lg:px-24'>
                <div className='rounded-2xl bg-dark/35 p-6 outline outline-dark'>
                    <div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'>
                        <div className='flex items-center gap-4'>
                            <div className='rounded-full bg-[#fd8738]/12 p-4 text-[#fd8738] outline outline-[#fd8738]/20'>
                                <Sparkles className='h-6 w-6' />
                            </div>
                            <div>
                                <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>AI workspace</p>
                                <h1 className='mt-1 text-3xl font-semibold text-bright/90'>Hanasand Codex</h1>
                                <p className='mt-2 max-w-3xl text-sm text-bright/45'>
                                    Chat with the live coding model, keep repository-aware conversation history, attach existing shares, and import public GitHub repositories into the same workspace.
                                </p>
                            </div>
                        </div>
                        <div className='rounded-xl bg-dark/25 px-4 py-3 outline outline-dark'>
                            <div className='flex items-center gap-3'>
                                <Bot className='h-4 w-4 text-[#fd8738]' />
                                <div className='text-sm text-bright/55'>
                                    {isAuthenticated
                                        ? `${initialShares.length} share workspaces available`
                                        : 'Sign in to attach your private shares'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className='flex min-h-[78vh] gap-4'>
                    <ChatSidebar
                        activeConversationId={ai.activeConversationId}
                        conversations={ai.filteredConversations}
                        search={ai.search}
                        setSearch={ai.setSearch}
                        onNewConversation={ai.createNewConversation}
                        onSelectConversation={ai.selectConversation}
                    />
                    <ChatPane
                        activeConversation={ai.activeConversation}
                        composer={ai.composer}
                        isConnected={ai.isConnected}
                        onComposerChange={ai.setComposer}
                        onSend={ai.sendPrompt}
                    />
                    <WorkspacePane
                        activeConversation={ai.activeConversation}
                        importedRepos={ai.importedRepos}
                        importInput={ai.importInput}
                        importError={ai.importError}
                        importPending={ai.importPending}
                        initialShares={ai.initialShares}
                        selectedRepoFilePath={ai.selectedRepoFilePath}
                        selectedShareContent={ai.selectedShareContent}
                        onAttachRepo={ai.attachRepo}
                        onAttachShare={ai.attachShare}
                        onImportInputChange={ai.setImportInput}
                        onImportRepo={ai.importRepo}
                        onSelectRepoFile={ai.selectRepoFile}
                    />
                </div>

                <div className='text-xs text-bright/28'>
                    Need the full editor? Open any attached share directly in <Link href='/dashboard' className='text-[#fd8738] hover:underline'>the coding workspace</Link>.
                </div>
            </div>
        </div>
    )
}
