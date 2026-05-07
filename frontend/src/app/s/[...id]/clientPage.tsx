'use client'

import Code from '@/components/share/code'
import Terminal from '@/components/share/terminal'
import Deploy from '@/components/share/deploy'
import Explorer from '@/components/share/tree/explorer'
import Metadata from '@/components/share/metadata'
import RenderSite from '@/components/share/renderSite'
import ShareChat from '@/components/share/shareChat'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Search from '@/components/share/search/search'
import OpenFiles from '@/components/share/files/openFiles'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import DisplayError from '@/components/share/search/displayError'
import { getCookie } from '@/utils/cookies/cookies'
import postShare from '@/utils/share/post'
import type { TerminalCredentials } from '@/hooks/useTerminal'
import { getShareRuntimeCapability } from '@/utils/share/runtimeCapabilities'
import { CheckCircle2, CloudOff, Code2, FileCode2, Loader2, MessageSquare, Radio, TerminalSquare } from 'lucide-react'
import { findPath, isWorkspaceRootItem } from '@/components/share/workspaceTree'
import type { ShareConflict, SharePresenceUser } from '@/components/share/useShareCodeSocket'

type ClientPageProps = {
    id: string
    share: Share | null
    openFolders: string[]
    tree: Tree | null
    sharePageWidth: number
    shareTerminalHeight: number
    serverOpenFiles: OpenFile[]
    autoCreate: boolean
    initialChatOpen: boolean
    replaceUrlOnCreate: boolean
}

export default function ClientPage({
    id,
    share: serverShare,
    openFolders,
    tree,
    sharePageWidth,
    shareTerminalHeight,
    serverOpenFiles,
    autoCreate,
    initialChatOpen,
    replaceUrlOnCreate,
}: ClientPageProps) {
    const [showExplorer, setShowExplorer] = useState(true)
    const [showMetadata, setShowMetaData] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
    const [saveState, setSaveState] = useState<'saved' | 'saving' | 'queued'>('saved')
    const [presenceUsers, setPresenceUsers] = useState<SharePresenceUser[]>([])
    const [selfClientId, setSelfClientId] = useState<string | null>(null)
    const [remoteNotice, setRemoteNotice] = useState<string | null>(null)
    const [conflict, setConflict] = useState<ShareConflict | null>(null)
    const [clickedWord, setClickedWord] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const [displayLineNumbers, setDisplayLineNumbers] = useState(true)
    const [syntaxHighlighting, setSyntaxHighlighting] = useState(true)
    const [box, setBox] = useState(false)
    const [share, setShare] = useState<Share | null>(serverShare)
    const [terminalOpen, setTerminalOpen] = useState(shareTerminalHeight > 0)
    const [terminalStatus, setTerminalStatus] = useState('Terminal closed.')
    const [terminalCredentials, setTerminalCredentials] = useState<TerminalCredentials | null>(null)
    const [workspaceTree, setWorkspaceTree] = useState<Tree | null>(tree)
    const [renderSite, setRenderSite] = useState<boolean>(sharePageWidth > 0)
    const [triggerSiteChange, setTriggerSiteChange] = useState<boolean | 'close'>(false)
    const [triggerTerminalChange, setTriggerTerminalChange] = useState<boolean | 'close'>(false)
    const [openFiles, setOpenFiles] = useState(serverOpenFiles)
    const [workspaceCreated, setWorkspaceCreated] = useState(!autoCreate)
    const [editorPatch, setEditorPatch] = useState<{ value: string; nonce: number } | null>(null)
    const [chatOpen, setChatOpen] = useState(initialChatOpen)
    const [hydrated, setHydrated] = useState(false)
    const [explorerPanelRequest, setExplorerPanelRequest] = useState<{ panel: 'files' | 'search'; nonce: number } | null>(null)
    const hasCreatedWorkspace = useRef(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const maxWidth = 'max-w-full'
    const runtimeCapability = useMemo(() => getShareRuntimeCapability({
        share,
        tree: workspaceTree,
        activeContent: editingContent,
    }), [editingContent, share, workspaceTree])
    const activePath = useMemo(() => findPath(workspaceTree, share?.id || id), [id, share?.id, workspaceTree])
    const activeIsRoot = isWorkspaceRootItem(workspaceTree, share, share?.id || id)
    const activeLabel = activeIsRoot ? 'Workspace root' : activePath || share?.alias || 'Loading file'
    const previewEvidenceUrl = share?.alias && runtimeCapability.canPreview ? `https://${share.alias}.hanasand.com/` : null
    const otherUsers = presenceUsers.filter(user => user.clientId !== selfClientId)
    const remoteEditors = otherUsers.filter(user => user.editing)

    useEffect(() => {
        setHydrated(true)
    }, [])

    useEffect(() => {
        if (!runtimeCapability.hasHttpSurface && renderSite) {
            setRenderSite(false)
        }
    }, [renderSite, runtimeCapability.hasHttpSurface])

    useEffect(() => {
        function handleShortcut(event: KeyboardEvent) {
            const key = event.key.toLowerCase()
            const usesModifier = event.metaKey || event.ctrlKey
            if (!usesModifier) {
                return
            }

            if (key === 's') {
                event.preventDefault()
                setSaveState('saving')
                setEditorPatch({ value: editingContent, nonce: Date.now() })
                setRemoteNotice('Save requested.')
                return
            }

            if (key === '`') {
                event.preventDefault()
                setTerminalOpen(true)
                return
            }

            if (key === 'f') {
                event.preventDefault()
                setShowExplorer(true)
                setExplorerPanelRequest({ panel: 'search', nonce: Date.now() })
            }
        }

        window.addEventListener('keydown', handleShortcut)
        return () => window.removeEventListener('keydown', handleShortcut)
    }, [editingContent])

    useEffect(() => {
        if (!autoCreate || hasCreatedWorkspace.current) {
            return
        }

        hasCreatedWorkspace.current = true
        setWorkspaceCreated(false)
        setSaveState('saving')

        async function createWorkspace() {
            const token = getCookie('access_token')
            const userId = getCookie('id')
            const normalizedName = id

            const createdShare = await postShare({
                includeTree: true,
                id,
                content: editingContent,
                name: normalizedName,
                path: normalizedName,
                type: 'folder',
                token,
                userId,
            })
            if (!createdShare) {
                hasCreatedWorkspace.current = false
                setWorkspaceCreated(false)
                setSaveState('queued')
                setError('Unable to save this workspace yet. Your editor stays open so you can retry.')
                return
            }

            setShare(createdShare)
            if ('tree' in createdShare && Array.isArray(createdShare.tree)) {
                setWorkspaceTree(createdShare.tree)
            }
            setWorkspaceCreated(true)
            setSaveState('saved')
            if (replaceUrlOnCreate) {
                window.history.replaceState(window.history.state, '', `/s/${id}${chatOpen ? '?chat=1' : ''}`)
            }
        }

        void createWorkspace()
    }, [autoCreate, chatOpen, editingContent, id, replaceUrlOnCreate, setError])

    return (
        <div className='flex w-full h-full max-w-[100vw] min-w-0 overflow-hidden gap-1 p-1 md:gap-2 md:p-2'>
            <div className={chatOpen ? 'hidden md:contents' : 'contents'}>
                <Explorer
                    showExplorer={showExplorer}
                    setShowExplorer={setShowExplorer}
                    openFolders={openFolders}
                    tree={workspaceTree}
                    share={share}
                    setShare={setShare}
                    editingContent={editingContent}
                    setEditorPatch={setEditorPatch}
                    setError={setError}
                    setPageTree={setWorkspaceTree}
                    panelRequest={explorerPanelRequest}
                />
            </div>
            <div className={`flex-1 flex flex-col min-h-full min-w-0 w-full gap-2 overflow-hidden text-foreground ${maxWidth}`}>
                <div className='flex min-h-10 items-center justify-between gap-2 rounded-xl border border-bright/10 bg-(--panel-surface) px-2 py-1.5 shadow-2xl shadow-black/20 backdrop-blur-md md:bg-background/72 md:shadow-black/10'>
                    <div className='min-w-0 flex flex-1 items-center gap-2'>
                        {chatOpen ? (
                            <div className='flex min-w-0 items-center gap-2 px-2 text-sm font-semibold text-bright/82'>
                                <MessageSquare className='h-4 w-4 shrink-0 text-[#f07d33]' />
                                <span className='truncate'>Chat</span>
                            </div>
                        ) : openFiles.length ? (
                            <OpenFiles openFiles={openFiles} setOpenFiles={setOpenFiles} />
                        ) : (
                            <div className='flex min-w-0 items-center gap-2 px-2 text-sm text-bright/62'>
                                <FileCode2 className='h-4 w-4 shrink-0 text-[#f07d33]' />
                                <span className='truncate'>{activeLabel}</span>
                            </div>
                        )}
                    </div>
                    {!chatOpen && (
                        <div className='hidden shrink-0 items-center gap-1.5 lg:flex'>
                            <StatusPill
                                icon={isConnected ? <Radio className='h-3.5 w-3.5' /> : <CloudOff className='h-3.5 w-3.5' />}
                                label={isConnected ? `${participants} live` : workspaceCreated ? 'Reconnecting' : 'Preparing'}
                                tone={isConnected ? 'good' : 'warn'}
                            />
                            <StatusPill
                                icon={saveState === 'saving' ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <CheckCircle2 className='h-3.5 w-3.5' />}
                                label={saveState === 'saving' ? 'Saving' : saveState === 'queued' ? 'Queued' : 'Saved'}
                                tone={saveState === 'saved' ? 'good' : 'warn'}
                            />
                            <StatusPill
                                icon={<TerminalSquare className='h-3.5 w-3.5' />}
                                label={normalizeTerminalStatus(terminalStatus)}
                                tone={terminalStatus.toLowerCase().includes('ready') ? 'good' : 'neutral'}
                            />
                        </div>
                    )}
                    <button
                        type='button'
                        aria-label={hydrated ? chatOpen ? 'Back to code editor' : 'Open workspace chat' : 'Preparing workspace chat'}
                        disabled={!hydrated}
                        onClick={() => setChatOpen(prev => !prev)}
                        className='inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-bright/10 bg-bright/[0.045] px-3 text-xs font-semibold text-bright/72 transition hover:border-[#f07d33]/35 hover:bg-[#f07d33]/12 hover:text-bright disabled:cursor-not-allowed disabled:opacity-45'
                    >
                        {chatOpen ? <Code2 className='h-4 w-4' /> : <MessageSquare className='h-4 w-4' />}
                        {chatOpen ? 'Back to code' : 'Build'}
                    </button>
                </div>
                {!chatOpen && (
                    <CollaborationStatus
                        users={presenceUsers}
                        otherUsers={otherUsers}
                        editors={remoteEditors}
                        notice={remoteNotice}
                        conflict={conflict}
                        onDismissNotice={() => setRemoteNotice(null)}
                        onUseRemote={() => {
                            if (!conflict) return
                            setEditingContent(conflict.remoteContent)
                            setEditorPatch({ value: conflict.remoteContent, nonce: Date.now() })
                            setConflict(null)
                            setRemoteNotice('Remote update applied.')
                        }}
                        onKeepMine={() => {
                            setConflict(null)
                            setRemoteNotice('Kept your local version.')
                            setSaveState('saving')
                            setEditorPatch({ value: editingContent, nonce: Date.now() })
                        }}
                    />
                )}
                {chatOpen ? (
                    <div className='min-h-0 flex-1 rounded-xl border border-bright/10 bg-(--panel-surface) p-2 shadow-2xl shadow-black/20 backdrop-blur-md md:bg-background/48'>
                        <ShareChat
                            share={share}
                            setShare={setShare}
                            tree={workspaceTree}
                            editingContent={editingContent}
                            setEditorPatch={setEditorPatch}
                            mode='workspace'
                            previewUrl={previewEvidenceUrl}
                        />
                    </div>
                ) : (
                    <Code
                        id={share?.id || id}
                        setParticipants={setParticipants}
                        setIsConnected={setIsConnected}
                        editingContent={editingContent}
                        setEditingContent={setEditingContent}
                        share={share}
                        setShare={setShare}
                        setClickedWord={setClickedWord}
                        displayLineNumbers={displayLineNumbers}
                        syntaxHighlighting={syntaxHighlighting}
                        setError={setError}
                        setSaveState={setSaveState}
                        saveState={saveState}
                        setPresenceUsers={setPresenceUsers}
                        setSelfClientId={setSelfClientId}
                        setRemoteNotice={setRemoteNotice}
                        setConflict={setConflict}
                        connect={workspaceCreated}
                        editorPatch={editorPatch}
                    />
                )}
            </div>
            {!chatOpen ? (
                <Metadata
                    shareRouteId={id}
                    share={share}
                    setShare={setShare}
                    isConnected={isConnected}
                    showMetadata={showMetadata}
                    setShowMetadata={setShowMetaData}
                    participants={participants}
                    clickedWord={clickedWord}
                    setClickedWord={setClickedWord}
                    editingContent={editingContent}
                    setDisplayLineNumbers={setDisplayLineNumbers}
                    syntaxHighlighting={syntaxHighlighting}
                    setSyntaxHighlighting={setSyntaxHighlighting}
                    box={box}
                    setBox={setBox}
                    terminalStatus={terminalStatus}
                    terminalCredentials={terminalCredentials}
                    tree={workspaceTree}
                    setEditorPatch={setEditorPatch}
                    setTriggerTerminalChange={setTriggerTerminalChange}
                />
            ) : null}
            <Terminal
                share={share}
                open={terminalOpen}
                setOpen={setTerminalOpen}
                shareTerminalHeight={shareTerminalHeight}
                triggerChange={triggerTerminalChange}
                setTriggerChange={setTriggerTerminalChange}
                setTerminalStatus={setTerminalStatus}
                setTerminalCredentials={setTerminalCredentials}
            />
            <Deploy
                terminalOpen={terminalOpen}
                setTerminalOpen={setTerminalOpen}
                capability={runtimeCapability}
            />
            <RenderSite
                share={share}
                renderSite={renderSite}
                setRenderSite={setRenderSite}
                sharePageWidth={sharePageWidth}
                triggerChange={triggerSiteChange}
                setTriggerChange={setTriggerSiteChange}
                capability={runtimeCapability}
            />
            <Search
                setTriggerSiteChange={setTriggerSiteChange}
                setBox={setBox}
                setTriggerTerminalChange={setTriggerTerminalChange}
                setShowExplorer={setShowExplorer}
                setShowMetaData={setShowMetaData}
            />
            <DisplayError
                error={error}
                onRetry={() => window.location.reload()}
                onDismiss={() => setError(null)}
            />
        </div>
    )
}

function CollaborationStatus({
    users,
    otherUsers,
    editors,
    notice,
    conflict,
    onDismissNotice,
    onUseRemote,
    onKeepMine,
}: {
    users: SharePresenceUser[]
    otherUsers: SharePresenceUser[]
    editors: SharePresenceUser[]
    notice: string | null
    conflict: ShareConflict | null
    onDismissNotice: () => void
    onUseRemote: () => void
    onKeepMine: () => void
}) {
    if (!users.length && !notice && !conflict) {
        return null
    }

    return (
        <div className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-bright/10 bg-(--panel-surface) px-3 py-2 text-xs text-bright/62 shadow-2xl shadow-black/20 backdrop-blur-md md:bg-background/50 md:shadow-black/10'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
                {otherUsers.length ? (
                    <div className='flex items-center gap-1.5'>
                        <div className='flex -space-x-1.5'>
                            {otherUsers.slice(0, 5).map(user => (
                                <span
                                    key={user.clientId}
                                    title={user.displayName}
                                    className='grid h-6 w-6 place-items-center rounded-full border border-background text-[10px] font-bold text-black'
                                    style={{ backgroundColor: user.color }}
                                >
                                    {initialsFor(user.displayName)}
                                </span>
                            ))}
                        </div>
                        <span className='text-[11px] text-bright/48'>{otherUsers.length === 1 ? '1 other user' : `${otherUsers.length} other users`}</span>
                    </div>
                ) : users.length ? (
                    <span className='rounded-lg border border-bright/10 bg-bright/[0.035] px-2 py-1 text-[11px] text-bright/45'>Only you here</span>
                ) : null}
                {editors.length ? (
                    <span className='rounded-lg border border-[#f07d33]/18 bg-[#f07d33]/8 px-2 py-1 text-[11px] font-semibold text-[#ffd0b5]'>
                        {formatEditors(editors)} editing{formatCursor(editors[0])}
                    </span>
                ) : null}
                {notice && !conflict ? (
                    <button type='button' onClick={onDismissNotice} className='rounded-lg border border-bright/10 bg-bright/[0.035] px-2 py-1 text-[11px] text-bright/58 transition hover:bg-bright/8 hover:text-bright'>
                        {notice}
                    </button>
                ) : null}
            </div>
            {conflict ? (
                <div className='flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/18 bg-amber-300/8 px-2 py-1.5 text-[11px] text-amber-100/82'>
                    <span>{conflict.author?.displayName || 'Someone'} edited this while your change was unsaved.</span>
                    <button type='button' onClick={onUseRemote} className='rounded-md bg-amber-100/14 px-2 py-1 font-semibold hover:bg-amber-100/22'>Use theirs</button>
                    <button type='button' onClick={onKeepMine} className='rounded-md bg-bright/10 px-2 py-1 font-semibold hover:bg-bright/16'>Keep mine</button>
                </div>
            ) : null}
        </div>
    )
}

function initialsFor(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase()
}

function formatEditors(editors: SharePresenceUser[]) {
    if (editors.length === 1) return editors[0].displayName
    if (editors.length === 2) return `${editors[0].displayName} and ${editors[1].displayName}`
    return `${editors[0].displayName} and ${editors.length - 1} others`
}

function formatCursor(user: SharePresenceUser | undefined) {
    if (!user?.cursorLine) return ''
    return ` · line ${user.cursorLine}`
}

function StatusPill({
    icon,
    label,
    tone,
}: {
    icon: ReactNode
    label: string
    tone: 'good' | 'warn' | 'neutral'
}) {
    const toneClass = tone === 'good'
        ? 'border-emerald-400/18 bg-emerald-400/8 text-emerald-200/82'
        : tone === 'warn'
            ? 'border-amber-300/18 bg-amber-300/8 text-amber-100/82'
            : 'border-bright/10 bg-bright/[0.045] text-bright/62'

    return (
        <span className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold ${toneClass}`}>
            {icon}
            {label}
        </span>
    )
}

function normalizeTerminalStatus(status: string) {
    const normalized = status.trim().replace(/\.$/, '')
    if (!normalized) return 'Terminal unknown'
    if (normalized.toLowerCase().includes('ready')) return 'Terminal ready'
    if (normalized.toLowerCase().includes('closed')) return 'Terminal closed'
    if (normalized.toLowerCase().includes('preparing')) return 'Terminal preparing'
    if (normalized.toLowerCase().includes('connecting')) return 'Terminal connecting'
    return normalized.length > 22 ? `${normalized.slice(0, 19)}...` : normalized
}
