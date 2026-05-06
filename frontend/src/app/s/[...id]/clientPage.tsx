'use client'

import Code from '@/components/share/code'
import Terminal from '@/components/share/terminal'
import Deploy from '@/components/share/deploy'
import Explorer from '@/components/share/tree/explorer'
import Metadata from '@/components/share/metadata'
import RenderSite from '@/components/share/renderSite'
import { useEffect, useMemo, useRef, useState } from 'react'
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
    const [showMetadata, setShowMetaData] = useState(true)
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
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
    const hasCreatedWorkspace = useRef(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const maxWidth = 'max-w-full'
    const runtimeCapability = useMemo(() => getShareRuntimeCapability({
        share,
        tree,
        activeContent: editingContent,
    }), [editingContent, share, tree])

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
                <OpenFiles openFiles={openFiles} setOpenFiles={setOpenFiles} />
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
                    connect={workspaceCreated}
                    editorPatch={editorPatch}
                />
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
