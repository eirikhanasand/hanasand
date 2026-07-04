'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { PanelRight, RotateCcw, SquareArrowOutUpRight, X } from 'lucide-react'
import ChatPane from '@/components/ai/chatPane'
import ChatSidebar from '@/components/ai/chatSidebar'
import WorkspacePane from '@/components/ai/workspacePane'
import useAiWorkbench from '@/components/ai/useAiWorkbench'

type AIPageMode = 'landing' | 'workspace' | 'compact'

export default function AIPageClient({
    initialConversations,
    initialRepositories,
    initialDeployments,
    initialReleases,
    initialDeployQuota,
    initialOwnershipSummary,
    initialShares,
    initialRuntimeState,
    isAuthenticated,
    compact = false,
    mode = 'landing',
    initialConversationId = null,
}: {
    initialConversations: AIConversation[]
    initialRepositories: AIImportedRepo[]
    initialDeployments: AIDeployment[]
    initialReleases: AIRelease[]
    initialDeployQuota: AIDeployQuota | null
    initialOwnershipSummary: AIOwnershipSummary | null
    initialShares: Share[]
    initialRuntimeState: AIRuntimeState | null
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
        initialDeployments,
        initialReleases,
        initialDeployQuota,
        initialOwnershipSummary,
        initialShares,
        initialRuntimeState,
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
        <div className={`${compact ? 'h-screen' : 'h-full'} enterprise-console relative w-full overflow-hidden bg-ui-canvas text-ui-text`}>
            <div className='flex h-full min-h-0 flex-col'>
                {showHeader ? (
                    <div className='flex h-14 items-center justify-between border-b border-ui-border bg-ui-panel px-5'>
                        <div className='min-w-0'>
                            <p className='truncate text-sm font-semibold text-ui-text'>
                                {conversationTitle(ai.activeConversation?.title)}
                            </p>
                        </div>
                        <div className='flex items-center gap-2'>
                            <button
                                type='button'
                                onClick={() => setDetailsOpen((prev) => !prev)}
                                aria-label={detailsOpen ? 'Hide workspace details' : 'Show workspace details'}
                                className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${detailsOpen ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}
                            >
                                <PanelRight className='h-4 w-4' />
                            </button>
                            <Link href={ai.activeConversation?.workspaceId ? `/s/${ai.activeConversation.workspaceId}` : '/s'} className='inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ui-muted transition-colors hover:bg-ui-raised hover:text-ui-text'>
                                Context
                                <SquareArrowOutUpRight className='h-4 w-4' />
                            </Link>
                        </div>
                    </div>
                ) : null}

                <div className={`grid min-h-0 w-full max-w-full flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden ${showWorkspaceRail && detailsOpen ? 'xl:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[16rem_minmax(0,1fr)_22rem]' : 'xl:grid-cols-[16rem_minmax(0,1fr)]'}`}>
                    <div className='hidden min-h-0 md:block'>
                        <ChatSidebar
                            activeConversationId={ai.activeConversationId}
                            archivedConversations={ai.archivedConversations}
                            conversations={ai.filteredConversations}
                            search={ai.search}
                            setSearch={ai.setSearch}
                            onArchiveConversation={ai.archiveConversation}
                            onDeleteConversation={ai.deleteConversation}
                            onNewConversation={ai.createNewConversation}
                            onRenameConversation={ai.renameConversation}
                            onSelectConversation={selectConversation}
                        />
                    </div>

                    <ChatPane
                        activeConversation={ai.activeConversation}
                        clients={ai.clients}
                        composer={ai.composer}
                        isConnected={ai.isConnected}
                        isAuthenticated={isAuthenticated}
                        participants={ai.participants}
                        landing={mode === 'landing'}
                        readOnly={ai.activeConversation?.collaboration?.role === 'reviewer'}
                        onComposerChange={ai.setComposer}
                        onModelStrategyChange={ai.setModelStrategy}
                        onPreferredModelChange={ai.setPreferredModel}
                        onSend={ai.sendPrompt}
                    />

                    {showWorkspaceRail && detailsOpen ? (
                        <div className='min-h-0 xl:col-span-2 2xl:col-span-1'>
                            <WorkspacePane
                                activeConversation={ai.activeConversation}
                                importedRepos={ai.importedRepos}
                                importInput={ai.importInput}
                                githubToken={ai.githubToken}
                                importError={ai.importError}
                                importPending={ai.importPending}
                                collaborationError={ai.collaborationError}
                                initialShares={ai.initialShares}
                                syncingRepoId={ai.syncingRepoId}
                                activeShareTree={ai.activeShareTree}
                                selectedRepoFilePath={ai.selectedRepoFilePath}
                                selectedShareFileContent={ai.selectedShareFileContent}
                                selectedShareContent={ai.selectedShareContent}
                                deployments={ai.deployments}
                                releases={ai.releases}
                                deployQuota={ai.deployQuota}
                                ownershipSummary={ai.ownershipSummary}
                                availableVmTargets={ai.availableVmTargets}
                                deployPending={ai.deployPending}
                                collaboratorPending={ai.collaboratorPending}
                                currentUserId={ai.currentUserId}
                                rollbackPendingId={ai.rollbackPendingId}
                                onAttachRepo={ai.attachRepo}
                                onAttachShare={ai.attachShare}
                                onImportInputChange={ai.setImportInput}
                                onGitHubTokenChange={ai.setGitHubToken}
                                onImportRepo={ai.importRepo}
                                onRefreshRepo={ai.refreshRepo}
                                onRevokeRepoCredential={ai.revokeRepoCredential}
                                onScaffoldStarter={ai.scaffoldStarter}
                                onStartDeployment={ai.startDeployment}
                                onInviteCollaborator={(input) => ai.inviteCollaborator(input.userId, input.role)}
                                onRollbackRelease={ai.rollbackRelease}
                                onRemoveCollaborator={ai.removeCollaborator}
                                onSelectRepoFile={ai.selectRepoFile}
                                onSelectShareFile={ai.selectShareFile}
                            />
                        </div>
                    ) : null}
                </div>

                {ai.statusNotice || ai.resumeNotice || (!ai.statusNotice && (ai.runtimeState.lastFailure || ai.runtimeState.lastToolRun)) ? (
                    <div className='pointer-events-none absolute right-4 top-20 z-20 grid w-[min(32rem,calc(100%-2rem))] gap-3'>
                        {ai.statusNotice ? (
                            <div className='pointer-events-auto rounded-lg border border-ui-warning/30 bg-ui-panel/95 px-4 py-3 text-sm text-ui-warning shadow-md backdrop-blur-xl'>
                                {ai.statusNotice}
                            </div>
                        ) : null}

                        {ai.resumeNotice ? (
                            <div className='pointer-events-auto flex items-start justify-between gap-3 rounded-lg border border-ui-success/30 bg-ui-panel/95 px-4 py-3 text-sm text-ui-text shadow-md backdrop-blur-xl'>
                                <div className='flex min-w-0 items-start gap-3'>
                                    <RotateCcw className='mt-0.5 h-4 w-4 shrink-0 text-ui-success' />
                                    <div className='min-w-0'>
                                        <p>{ai.resumeNotice.message}</p>
                                        {ai.resumeNotice.workspaceId ? (
                                            <Link href={`/s/${ai.resumeNotice.workspaceId}`} className='mt-2 inline-flex items-center gap-2 text-xs font-semibold text-ui-primary underline-offset-4 hover:underline'>
                                                Open recovered workspace
                                                <SquareArrowOutUpRight className='h-3.5 w-3.5' />
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>
                                <button
                                    type='button'
                                    onClick={() => ai.setResumeNotice(null)}
                                    className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-muted transition-colors hover:bg-ui-raised hover:text-ui-text'
                                    aria-label='Dismiss resume notice'
                                >
                                    <X className='h-4 w-4' />
                                </button>
                            </div>
                        ) : null}

                        {!ai.statusNotice && (ai.runtimeState.lastFailure || ai.runtimeState.lastToolRun) ? (
                            <div className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-md backdrop-blur-xl ${ai.runtimeState.lastFailure ? 'border-ui-danger/30 bg-ui-panel/95 text-ui-danger' : 'border-ui-border bg-ui-panel/95 text-ui-muted'}`}>
                                {ai.runtimeState.lastFailure?.message || ai.runtimeState.lastToolRun?.detail || runtimeStateSummary(ai.runtimeState)}
                            </div>
                        ) : null}
                    </div>
                ) : null}

            </div>
        </div>
    )
}

function conversationTitle(title?: string | null) {
    const normalized = title?.trim()
    return !normalized || normalized === 'New chat' || normalized === 'New workspace review' || normalized === 'Workspace review' ? 'Review assistant' : normalized
}

function runtimeStateSummary(runtimeState: AIRuntimeState) {
    if (runtimeState.connectedClientCount > 0) {
        return `${runtimeState.connectedClientCount} review connection${runtimeState.connectedClientCount === 1 ? '' : 's'} ready`
    }

    return 'Review assistant paused'
}
