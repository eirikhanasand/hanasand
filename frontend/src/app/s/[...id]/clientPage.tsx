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
import getAgentTarget from '@/utils/vms/fetch/getAgentTarget'
import syncAgentTargetAccess from '@/utils/vms/fetch/syncAgentTargetAccess'
import postVM from '@/utils/vms/fetch/postVM'
import type { TerminalCredentials } from '@/hooks/useTerminal'
import { getShareRuntimeCapability } from '@/utils/share/runtimeCapabilities'
import { CheckCircle2, CloudOff, Code2, FileCode2, Loader2, MessageSquare, Radio, TerminalSquare } from 'lucide-react'
import { countTreeItems, findPath, getVisibleWorkspaceTree, getWorkspaceName, isWorkspaceRootItem } from '@/components/share/workspaceTree'

type ClientPageProps = {
    id: string
    share: Share | null
    openFolders: string[]
    tree: Tree | null
    sharePageWidth: number
    shareTerminalHeight: number
    serverOpenFiles: OpenFile[]
    autoCreate: boolean
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
    replaceUrlOnCreate,
}: ClientPageProps) {
    const [showExplorer, setShowExplorer] = useState(true)
    const [showMetadata, setShowMetaData] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
    const [saveState, setSaveState] = useState<'saved' | 'saving' | 'queued'>('saved')
    const [clickedWord, setClickedWord] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const [displayLineNumbers, setDisplayLineNumbers] = useState(true)
    const [syntaxHighlighting, setSyntaxHighlighting] = useState(true)
    const [box, setBox] = useState(false)
    const [share, setShare] = useState<Share | null>(serverShare)
    const [terminalOpen, setTerminalOpen] = useState(shareTerminalHeight > 0)
    const [terminalStatus, setTerminalStatus] = useState('Terminal closed.')
    const [terminalCredentials, setTerminalCredentials] = useState<TerminalCredentials | null>(null)
    const [renderSite, setRenderSite] = useState<boolean>(sharePageWidth > 0)
    const [triggerSiteChange, setTriggerSiteChange] = useState<boolean | 'close'>(false)
    const [triggerTerminalChange, setTriggerTerminalChange] = useState<boolean | 'close'>(false)
    const [openFiles, setOpenFiles] = useState(serverOpenFiles)
    const [workspaceCreated, setWorkspaceCreated] = useState(!autoCreate)
    const [editorPatch, setEditorPatch] = useState<{ value: string; nonce: number } | null>(null)
    const [chatOpen, setChatOpen] = useState(false)
    const hasCreatedWorkspace = useRef(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const maxWidth = 'max-w-full'
    const runtimeCapability = useMemo(() => getShareRuntimeCapability({
        share,
        tree,
        activeContent: editingContent,
    }), [editingContent, share, tree])
    const visibleTree = useMemo(() => getVisibleWorkspaceTree(tree, share), [share, tree])
    const workspaceCounts = useMemo(() => countTreeItems(visibleTree), [visibleTree])
    const activePath = useMemo(() => findPath(tree, share?.id || id), [id, share?.id, tree])
    const activeIsRoot = isWorkspaceRootItem(tree, share, share?.id || id)
    const workspaceName = getWorkspaceName(tree, share, id)
    const activeLabel = activeIsRoot ? 'Workspace root' : activePath || share?.alias || 'Loading file'
    const activeDetail = activeIsRoot
        ? editingContent.trim().length > 0
            ? 'Root note'
            : 'Open a file from the left sidebar'
        : `${editingContent.split(/\s+/).filter(Boolean).length} words`

    useEffect(() => {
        if (!runtimeCapability.hasHttpSurface && renderSite) {
            setRenderSite(false)
        }
    }, [renderSite, runtimeCapability.hasHttpSurface])

    useEffect(() => {
        if (!autoCreate || hasCreatedWorkspace.current) {
            return
        }

        hasCreatedWorkspace.current = true

        async function createWorkspace() {
            const token = getCookie('access_token')
            const userId = getCookie('id')
            const normalizedName = id
            const vmName = normalizedName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 48) || `vm-${id.toLowerCase()}`

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
                setError('Unable to save this workspace yet. Your editor stays open so you can retry.')
                return
            }

            setShare(createdShare)
            setWorkspaceCreated(true)
            if (replaceUrlOnCreate) {
                window.history.replaceState(window.history.state, '', `/s/${id}`)
            }

            if (!token || !userId) {
                return
            }

            const vmResult = await postVM({ name: vmName })
            if (vmResult.status >= 400 && vmResult.status !== 409) {
                setError(vmResult.message)
                return
            }

            const syncResult = await syncAgentTargetAccess(vmName, 'current_user')
            if (syncResult.status >= 400 || !syncResult.body?.ok) {
                setError(syncResult.message)
                return
            }

            const targetResult = await getAgentTarget(vmName)
            if (targetResult.status >= 400 || !targetResult.target) {
                setError(targetResult.message)
            }
        }

        void createWorkspace()
    }, [autoCreate, editingContent, id, replaceUrlOnCreate, setError])

    return (
        <div className='flex w-full h-full max-w-[100vw] min-w-0 overflow-hidden p-2 gap-2'>
            <Explorer
                showExplorer={showExplorer}
                setShowExplorer={setShowExplorer}
                openFolders={openFolders}
                tree={tree}
                share={share}
                setShare={setShare}
                editingContent={editingContent}
                setEditorPatch={setEditorPatch}
                setError={setError}
            />
            <div className={`flex-1 flex flex-col min-h-full min-w-0 w-full gap-2 overflow-hidden text-foreground ${maxWidth}`}>
                <div className='flex min-h-10 items-center justify-between gap-2 rounded-xl border border-bright/10 bg-background/72 px-2 py-1.5 shadow-2xl shadow-black/10 backdrop-blur-md'>
                    <div className='min-w-0 flex flex-1 items-center gap-3'>
                        <div className='hidden min-w-0 border-r border-bright/10 pr-3 md:block'>
                            <div className='truncate text-sm font-semibold text-bright/84'>{workspaceName}</div>
                            <div className='text-[11px] leading-4 text-bright/42'>{workspaceCounts.files} files · {workspaceCounts.folders} folders</div>
                        </div>
                        {chatOpen ? (
                            <div className='flex items-center gap-2 px-2 text-sm font-semibold text-bright/82'>
                                <MessageSquare className='h-4 w-4 text-[#f07d33]' />
                                <span className='truncate'>Chat workspace</span>
                            </div>
                        ) : (
                            <div className='min-w-0 flex-1'>
                                <OpenFiles openFiles={openFiles} setOpenFiles={setOpenFiles} />
                            </div>
                        )}
                    </div>
                    <button
                        type='button'
                        onClick={() => setChatOpen(prev => !prev)}
                        className='inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-bright/10 bg-bright/[0.045] px-3 text-xs font-semibold text-bright/72 transition hover:border-[#f07d33]/35 hover:bg-[#f07d33]/12 hover:text-bright'
                    >
                        {chatOpen ? <Code2 className='h-4 w-4' /> : <MessageSquare className='h-4 w-4' />}
                        {chatOpen ? 'Back to code' : 'Open Chat'}
                    </button>
                </div>
                {!chatOpen && (
                    <div className='flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-xl border border-bright/10 bg-background/58 px-3 py-2 text-xs text-bright/62 shadow-2xl shadow-black/10 backdrop-blur-md'>
                        <div className='flex min-w-0 items-center gap-2'>
                            <FileCode2 className='h-4 w-4 shrink-0 text-[#f07d33]' />
                            <div className='min-w-0'>
                                <div className='truncate font-semibold text-bright/84'>{activeLabel}</div>
                                <div className='truncate text-[11px] leading-4 text-bright/42'>{activeDetail}</div>
                            </div>
                        </div>
                        <div className='flex shrink-0 flex-wrap items-center justify-end gap-1.5'>
                            <StatusPill
                                icon={isConnected ? <Radio className='h-3.5 w-3.5' /> : <CloudOff className='h-3.5 w-3.5' />}
                                label={isConnected ? 'Connected' : workspaceCreated ? 'Reconnecting' : 'Preparing'}
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
                    </div>
                )}
                {chatOpen ? (
                    <div className='min-h-0 flex-1 rounded-xl border border-bright/10 bg-background/48 p-2 shadow-2xl shadow-black/20 backdrop-blur-md'>
                        <ShareChat
                            share={share}
                            setShare={setShare}
                            tree={tree}
                            editingContent={editingContent}
                            setEditorPatch={setEditorPatch}
                            mode='workspace'
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
                        connect={workspaceCreated}
                        editorPatch={editorPatch}
                    />
                )}
            </div>
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
                tree={tree}
                setEditorPatch={setEditorPatch}
                setTriggerTerminalChange={setTriggerTerminalChange}
            />
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
            <DisplayError error={error} />
        </div>
    )
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
