'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { Bot, ChevronRight, Cpu, FolderGit2, Route, Share2 } from 'lucide-react'
import ChatPane from '@/components/ai/chatPane'
import ChatSidebar from '@/components/ai/chatSidebar'
import WorkspacePane from '@/components/ai/workspacePane'
import useAiWorkbench from '@/components/ai/useAiWorkbench'

export default function AIPageClient({
    initialConversations,
    initialRepositories,
    initialShares,
    isAuthenticated,
    compact = false,
}: {
    initialConversations: AIConversation[]
    initialRepositories: AIImportedRepo[]
    initialShares: Share[]
    isAuthenticated: boolean
    compact?: boolean
}) {
    const ai = useAiWorkbench({
        initialConversations,
        initialRepositories,
        initialShares,
        isAuthenticated,
    })
    const [activeTool, setActiveTool] = useState<'search' | 'workspace' | 'models' | null>(null)

    return (
        <div className={`${compact ? 'h-screen' : 'h-[calc(100vh-4.5rem)]'} w-full overflow-hidden`}>
            <div className={`flex h-full flex-col ${compact ? 'px-3 pb-3 pt-3' : 'px-4 pb-4 pt-4 md:px-6 lg:px-8'}`}>
                {!compact ? <div className='mb-3 flex shrink-0 items-center justify-between rounded-2xl bg-dark/35 px-4 py-3 outline outline-dark'>
                    <div className='flex min-w-0 items-center gap-3'>
                        <div className='rounded-xl bg-[#fd8738]/12 p-2.5 text-[#fd8738] outline outline-[#fd8738]/20'>
                            <Bot className='h-4 w-4' />
                        </div>
                        <div className='min-w-0'>
                            <p className='text-[11px] uppercase tracking-[0.26em] text-bright/35'>Hanasand</p>
                            <h1 className='mt-1 text-lg font-semibold text-bright/92'>Coding workspace</h1>
                        </div>
                    </div>
                    <div className='flex items-center gap-2'>
                        <Link href='/ai/window' target='_blank' className='inline-flex items-center gap-2 rounded-xl bg-dark/30 px-3 py-2 text-sm text-bright/70 outline outline-dark transition-colors hover:text-[#fd8738]'>
                            Local window
                            <ChevronRight className='h-4 w-4' />
                        </Link>
                        <Link href={ai.activeConversation?.workspaceId ? `/s/${ai.activeConversation.workspaceId}` : '/s'} className='inline-flex items-center gap-2 rounded-xl bg-dark/30 px-3 py-2 text-sm text-bright/70 outline outline-dark transition-colors hover:text-[#fd8738]'>
                            Full editor
                            <ChevronRight className='h-4 w-4' />
                        </Link>
                    </div>
                </div> : null}

                <div className={`grid min-h-0 flex-1 gap-4 ${compact ? 'grid-cols-1' : 'xl:grid-cols-[18rem_minmax(0,1fr)]'}`}>
                    {!compact ? <ChatSidebar
                        activeConversationId={ai.activeConversationId}
                        archivedConversations={ai.archivedConversations}
                        conversations={ai.filteredConversations}
                        activeTool={activeTool}
                        isAuthenticated={ai.isAuthenticated}
                        search={ai.search}
                        setSearch={ai.setSearch}
                        onArchiveConversation={ai.archiveConversation}
                        onDeleteConversation={ai.deleteConversation}
                        onNewConversation={ai.createNewConversation}
                        onRenameConversation={ai.renameConversation}
                        onSelectConversation={ai.selectConversation}
                        onToggleTool={setActiveTool}
                        toolPanel={activeTool === 'models' ? (
                            <div className='grid gap-3'>
                                <ToolStat icon={<Route className='h-4 w-4' />} label='Routing' value={ai.activeConversation?.modelStrategy === 'pinned' ? 'Pinned model' : 'Automatic failover'} />
                                <ToolStat icon={<Cpu className='h-4 w-4' />} label='Model' value={ai.activeConversation?.activeModel || ai.activeConversation?.preferredModel || 'Best available'} />
                                <ToolStat icon={<Share2 className='h-4 w-4' />} label='Shares' value={`${ai.activeConversation?.shareIds?.length || 0} attached`} />
                                <ToolStat icon={<FolderGit2 className='h-4 w-4' />} label='Repositories' value={`${ai.importedRepos.length} imported`} />
                                <div className='grid gap-2'>
                                    <select value={ai.activeConversation?.modelStrategy || 'auto'} onChange={(event) => ai.setModelStrategy(event.target.value as 'auto' | 'pinned')} className='rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/85 outline outline-dark'>
                                        <option value='auto'>Auto model</option>
                                        <option value='pinned'>Pinned model</option>
                                    </select>
                                    <select value={ai.activeConversation?.preferredModel || ''} onChange={(event) => ai.setPreferredModel(event.target.value || null)} className='rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/85 outline outline-dark'>
                                        <option value=''>Best available</option>
                                        {ai.clients.map((client) => <option key={client.name} value={client.name}>{client.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        ) : (
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
                        )}
                    /> : null}
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
                </div>
                {ai.statusNotice ? (
                    <div className='mt-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100 outline outline-amber-500/20'>
                        {ai.statusNotice}
                    </div>
                ) : null}
                {!compact && !ai.filteredConversations.length && !ai.archivedConversations.length ? (
                    <div className='mt-4 rounded-3xl bg-dark/35 p-5 outline outline-dark'>
                        <div className='flex flex-wrap items-start gap-4'>
                            <div className='max-w-4xl'>
                                <h2 className='text-lg font-semibold text-bright/92'>Start with a prompt, then open tools only when you need them</h2>
                                <p className='mt-2 text-sm leading-6 text-bright/48'>
                                    Create a chat, attach a share or imported repo from the sidebar tools, and keep building. Completed chats persist so another connected model can pick up where the last one left off.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

function ToolStat({
    icon,
    label,
    value,
}: {
    icon: ReactNode
    label: string
    value: string
}) {
    return (
        <div className='flex items-center gap-3 rounded-xl bg-dark/30 px-3 py-2 outline outline-dark'>
            <span className='text-[#fd8738]'>{icon}</span>
            <div className='min-w-0'>
                <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>{label}</div>
                <div className='truncate text-sm text-bright/85'>{value}</div>
            </div>
        </div>
    )
}
