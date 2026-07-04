'use client'

import Notify from '@/components/notify/notify'
import GitPlugin from '@/components/share/gitPlugin'
import Info from '@/components/share/info'
import Lock from '@/components/share/lock'
import ReferencePanel from '@/components/share/referencePanel'
import ShareChat from '@/components/share/shareChat'
import WordControl from '@/components/share/wordControl'
import WorkspaceStatus from '@/components/share/workspaceStatus'
import type { TerminalCredentials } from '@/hooks/useTerminal'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import HideIfLittleSpace from '@/hooks/useHideIfLittleSpace'
import useMovable from '@/hooks/movable'
import copy from '@/utils/copy'
import { Activity, Copy, Eye, GitBranch, Highlighter, Info as InfoIcon, KeyRound, ListOrdered, MessageSquare, Package, RefreshCw, Smartphone, TerminalSquare, X } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import Box from '../box/box'
import PhoneSimulator from './phoneSimulator'
import SidebarTooltip from './sidebarTooltip'

type MetadataProps = {
    shareRouteId: string
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    isConnected: boolean
    showMetadata: boolean
    setShowMetadata: Dispatch<SetStateAction<boolean>>
    participants: number
    clickedWord: string | null
    setClickedWord: Dispatch<SetStateAction<string | null>>
    editingContent: string
    setDisplayLineNumbers: Dispatch<SetStateAction<boolean>>
    syntaxHighlighting: boolean
    setSyntaxHighlighting: Dispatch<SetStateAction<boolean>>
    box: boolean
    setBox: Dispatch<SetStateAction<boolean>>
    terminalStatus: string
    terminalCredentials: TerminalCredentials | null
    tree?: Tree | null
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
    setTriggerTerminalChange: Dispatch<SetStateAction<boolean | 'close'>>
}

type MetadataPanel = 'workspace' | 'info' | 'terminal' | 'symbols' | 'git' | 'phone' | 'box' | 'chat' | null

const sharedStyles = 'absolute grid place-items-center rounded-lg cursor-move z-100 select-none border border-ui-border bg-ui-panel/85 p-5 text-ui-muted backdrop-blur-md transition hover:bg-ui-raised hover:text-ui-text'
const baseButtonStyle = 'grid h-10 w-10 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
const activeButtonStyle = 'bg-ui-primary/10 text-ui-primary hover:bg-ui-primary/15 hover:text-ui-primary'

export default function Metadata({
    shareRouteId,
    share,
    setShare,
    isConnected,
    showMetadata,
    setShowMetadata,
    participants,
    clickedWord,
    setClickedWord,
    editingContent,
    setDisplayLineNumbers,
    setSyntaxHighlighting,
    syntaxHighlighting,
    box,
    setBox,
    terminalStatus,
    terminalCredentials,
    tree,
    setEditorPatch,
    setTriggerTerminalChange,
}: MetadataProps) {
    const { position, handleMouseDown } = useMovable({ side: 'right', setHide: setShowMetadata })
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [activePanel, setActivePanel] = useState<MetadataPanel>('workspace')
    const [isCompactViewport, setIsCompactViewport] = useState(false)
    const [localOpen, setLocalOpen] = useState(showMetadata)
    const metadataOpen = showMetadata || localOpen
    HideIfLittleSpace({ set: setShowMetadata, minWidth: 1180 })
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 350,
        onClear: () => setDidCopy(false)
    })

    useEffect(() => {
        const updateCompactViewport = () => setIsCompactViewport(window.innerWidth < 640)
        updateCompactViewport()
        window.addEventListener('resize', updateCompactViewport)
        return () => window.removeEventListener('resize', updateCompactViewport)
    }, [])

    useEffect(() => {
        setLocalOpen(showMetadata)
    }, [showMetadata])

    function closeMetadata() {
        setLocalOpen(false)
        setShowMetadata(false)
    }

    if (!metadataOpen) {
        const color = isConnected ? 'text-ui-success/45 group-hover:text-ui-success' : 'text-ui-muted'
        const compactStyle = isCompactViewport ? { right: 16, bottom: 88 } : { top: position.y, left: position.x }
        return (
            <button
                type='button'
                aria-label='Open share metadata'
                onMouseDown={(event) => {
                    if (!isCompactViewport) {
                        handleMouseDown(event)
                    }
                }}
                onClick={() => {
                    setLocalOpen(true)
                    setShowMetadata(true)
                }}
                className={`group ${isCompactViewport ? 'fixed right-4 bottom-22 grid place-items-center rounded-lg border border-ui-border bg-ui-panel/90 p-3 text-ui-muted shadow-2xl backdrop-blur-md hover:bg-ui-raised hover:text-ui-text' : sharedStyles}`}
                style={compactStyle}
            >
                <h1>
                    <InfoIcon className={!isConnected ? color : 'text-ui-muted group-hover:text-ui-text'} />
                </h1>
                {isConnected && (
                    <h1 className='flex gap-2 text-ui-muted group-hover:text-ui-text'>
                        {participants}
                        <Eye className={color} />
                    </h1>
                )}
            </button>
        )
    }

    function togglePanel(panel: Exclude<MetadataPanel, null>) {
        setActivePanel(prev => prev === panel ? null : panel)
    }

    const panelVisible = activePanel !== null
    const panelTitle = getPanelTitle(activePanel)

    return (
        <div className='flex h-full min-w-fit flex-row-reverse gap-2'>
            <nav className='relative z-50 flex h-full w-14 shrink-0 flex-col items-center gap-2 overflow-visible rounded-xl border border-ui-border bg-ui-panel/90 p-2 shadow-2xl backdrop-blur-md'>
                <SidebarTooltip label='Close' side='left'>
                    <button type='button' aria-label='Close metadata' onClick={closeMetadata} className={baseButtonStyle}>
                        <X className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Status' side='left'>
                    <button
                        type='button'
                        aria-label='Workspace status'
                        onClick={() => togglePanel('workspace')}
                        className={`${baseButtonStyle} ${activePanel === 'workspace' ? activeButtonStyle : ''}`}
                    >
                        <Activity className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Details' side='left'>
                    <button
                        type='button'
                        aria-label='Share details'
                        onClick={() => togglePanel('info')}
                        className={`${baseButtonStyle} ${activePanel === 'info' ? activeButtonStyle : ''}`}
                    >
                        <Eye className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Terminal' side='left'>
                    <button
                        type='button'
                        aria-label='Terminal access'
                        onClick={() => togglePanel('terminal')}
                        className={`${baseButtonStyle} ${activePanel === 'terminal' ? activeButtonStyle : ''}`}
                    >
                        <TerminalSquare className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Symbols' side='left'>
                    <button
                        type='button'
                        aria-label='Symbols'
                        onClick={() => togglePanel('symbols')}
                        className={`${baseButtonStyle} ${activePanel === 'symbols' ? activeButtonStyle : ''}`}
                    >
                        <ListOrdered className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Reload' side='left'>
                    <Link prefetch={false} href={`/s/${share?.id || shareRouteId}`} aria-label='Reload current share workspace' className={baseButtonStyle}>
                        <RefreshCw className='h-5 w-5' />
                    </Link>
                </SidebarTooltip>
                <SidebarTooltip label='Copy file' side='left'>
                    <button type='button' aria-label='Copy current file contents' onClick={() => copy({ text: editingContent, setDidCopy })} className={baseButtonStyle}>
                        <Copy height={20} width={20} className={didCopy === true ? 'text-ui-success' : didCopy === false ? 'text-ui-text' : 'text-ui-danger'} />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label={share?.locked ? 'Unlock' : 'Lock'} side='left'>
                    <Lock baseButtonStyle={baseButtonStyle} share={share} setError={setError} />
                </SidebarTooltip>
                <SidebarTooltip label='Line numbers' side='left'>
                    <button type='button' aria-label='Toggle line numbers' onClick={() => setDisplayLineNumbers(prev => !prev)} className={baseButtonStyle}>
                        <ListOrdered height={20} width={20} />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Highlighting' side='left'>
                    <button
                        type='button'
                        aria-label={syntaxHighlighting ? 'Disable syntax highlighting' : 'Enable syntax highlighting'}
                        onClick={() => setSyntaxHighlighting(prev => !prev)}
                        className={baseButtonStyle}
                    >
                        <Highlighter className={!syntaxHighlighting ? 'text-ui-primary' : 'text-ui-text'} height={20} width={20} />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Tool box' side='left'>
                    <button
                        type='button'
                        aria-label='Tool box'
                        onClick={() => {
                            setBox(true)
                            togglePanel('box')
                        }}
                        className={`${baseButtonStyle} ${activePanel === 'box' ? activeButtonStyle : ''}`}
                    >
                        <Package height={20} width={20} />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Chat' side='left'>
                    <button
                        type='button'
                        aria-label='Chat'
                        onClick={() => togglePanel('chat')}
                        className={`${baseButtonStyle} ${activePanel === 'chat' ? activeButtonStyle : ''}`}
                    >
                        <MessageSquare height={20} width={20} />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Git' side='left'>
                    <button
                        type='button'
                        aria-label='Git plugin'
                        onClick={() => togglePanel('git')}
                        className={`${baseButtonStyle} ${activePanel === 'git' ? activeButtonStyle : ''}`}
                    >
                        <GitBranch height={20} width={20} />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Phone' side='left'>
                    <button
                        type='button'
                        aria-label='Phone simulator'
                        onClick={() => togglePanel('phone')}
                        className={`${baseButtonStyle} ${activePanel === 'phone' ? activeButtonStyle : ''}`}
                    >
                        <Smartphone height={20} width={20} />
                    </button>
                </SidebarTooltip>
            </nav>
            {panelVisible ? (
                <div className={`relative z-10 min-w-0 h-full ${activePanel === 'box'
                    ? 'w-[min(72rem,calc(100vw-5.5rem))] lg:w-[min(72rem,56vw)]'
                    : activePanel === 'chat'
                        ? 'w-[min(42rem,calc(100vw-5.5rem))] lg:w-[min(42rem,34vw)]'
                        : activePanel === 'phone'
                            ? 'w-[min(30rem,calc(100vw-5.5rem))]'
                            : 'w-[min(24rem,calc(100vw-5.5rem))] lg:w-[min(24rem,21vw)]'
                }`}>
                    <div className='h-full w-full max-w-full space-y-2 overflow-y-auto overflow-x-hidden rounded-xl border border-ui-border bg-ui-panel/90 p-2 shadow-2xl backdrop-blur-md'>
                        <header className='flex items-center justify-between rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-ui-text'>
                            <span className='text-[11px] font-semibold uppercase tracking-[0.22em] text-ui-muted'>{panelTitle}</span>
                            <button type='button' aria-label='Hide metadata panel' onClick={() => setActivePanel(null)} className='grid h-8 w-8 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-panel hover:text-ui-text'>
                                <X className='h-4 w-4' />
                            </button>
                        </header>
                        <Notify message={error} />
                        {activePanel === 'workspace' ? (
                            <WorkspaceStatus
                                shareRouteId={shareRouteId}
                                share={share}
                                tree={tree || null}
                                terminalStatus={terminalStatus}
                                setTriggerTerminalChange={setTriggerTerminalChange}
                            />
                        ) : null}
                        {activePanel === 'git' ? <GitPlugin shareRouteId={shareRouteId} share={share} /> : null}
                        {activePanel === 'phone' ? <PhoneSimulator share={share} open /> : null}
                        {activePanel === 'info' ? (
                            <Info share={share} isConnected={isConnected} participants={participants} />
                        ) : null}
                        {activePanel === 'terminal' ? (
                            <TerminalAccess
                                status={terminalStatus}
                                credentials={terminalCredentials}
                                setDidCopy={setDidCopy}
                            />
                        ) : null}
                        {activePanel === 'symbols' ? (
                            <>
                                <WordControl clickedWord={clickedWord} />
                                <ReferencePanel
                                    tree={tree || null}
                                    share={share}
                                    clickedWord={clickedWord}
                                    setClickedWord={setClickedWord}
                                    editingContent={editingContent}
                                />
                            </>
                        ) : null}
                        {activePanel === 'box' ? <Box box={box} setBox={setBox} share={share} /> : null}
                        {activePanel === 'chat' ? (
                            <ShareChat
                                share={share}
                                setShare={setShare}
                                tree={tree}
                                editingContent={editingContent}
                                setEditorPatch={setEditorPatch}
                            />
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

function getPanelTitle(panel: MetadataPanel) {
    switch (panel) {
        case 'workspace':
            return 'Workspace status'
        case 'info':
            return 'Share details'
        case 'terminal':
            return 'Terminal access'
        case 'symbols':
            return 'Symbols'
        case 'git':
            return 'Git'
        case 'phone':
            return 'Phone preview'
        case 'box':
            return 'Tool box'
        case 'chat':
            return 'Chat'
        default:
            return ''
    }
}

function TerminalAccess({
    status,
    credentials,
    setDidCopy,
}: {
    status: string
    credentials: TerminalCredentials | null
    setDidCopy: Dispatch<SetStateAction<boolean | string | null>>
}) {
    return (
        <section className='space-y-3 text-ui-muted'>
            <div className='rounded-lg border border-ui-success/30 bg-ui-success/10 p-3'>
                <div className='mb-2 flex items-center justify-between gap-2'>
                    <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                        <TerminalSquare className='h-4 w-4 text-ui-success' />
                        Browser terminal
                    </div>
                    <span className='rounded-full border border-ui-success/35 bg-ui-success/15 px-2 py-0.5 text-[11px] font-medium text-ui-success'>
                        Interactive
                    </span>
                </div>
                <div className='flex items-start gap-2 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 text-xs leading-4 text-ui-muted'>
                    <span className='mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-ui-success' />
                    <span>{status || 'Waiting for terminal status...'}</span>
                </div>
            </div>

            <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                <div className='mb-3 flex items-center gap-2 text-sm font-semibold text-ui-text'>
                    <KeyRound className='h-4 w-4' />
                    SSH access
                </div>

                {credentials ? (
                    <div className='space-y-3 text-xs'>
                        <button
                            type='button'
                            onClick={() => copy({ text: credentials.sshCommand, setDidCopy })}
                            className='flex w-full items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-left transition-colors hover:border-ui-primary hover:bg-ui-raised'
                        >
                            <span className='min-w-0'>
                                <span className='block text-[10px] uppercase tracking-[0.18em] text-ui-muted'>Copy SSH command</span>
                                <span className='block truncate font-mono text-[11px] leading-4 text-ui-text'>{credentials.sshCommand}</span>
                            </span>
                            <Copy className='h-4 w-4 shrink-0 text-ui-muted' />
                        </button>
                        <CredentialRow label='User' value={credentials.username} setDidCopy={setDidCopy} />
                        <CredentialRow label='Password' value={credentials.password} sensitive setDidCopy={setDidCopy} />
                        <CredentialRow label='Domain' value={credentials.domain} setDidCopy={setDidCopy} />
                    </div>
                ) : (
                    <div className='space-y-2'>
                        <button
                            type='button'
                            disabled
                            className='flex w-full cursor-not-allowed items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-left opacity-55'
                        >
                            <span className='min-w-0'>
                                <span className='block text-[10px] uppercase tracking-[0.18em] text-ui-muted'>Copy SSH command</span>
                                <span className='block truncate font-mono text-[11px] leading-4 text-ui-muted'>Waiting for SSH details</span>
                            </span>
                            <Copy className='h-4 w-4 shrink-0 text-ui-muted' />
                        </button>
                        <div className='rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 text-xs leading-5 text-ui-muted'>
                            SSH details appear here when the VM is reachable.
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}

function CredentialRow({
    label,
    value,
    sensitive = false,
    setDidCopy,
}: {
    label: string
    value: string
    sensitive?: boolean
    setDidCopy: Dispatch<SetStateAction<boolean | string | null>>
}) {
    return (
        <button
            type='button'
            onClick={() => copy({ text: value, setDidCopy })}
            className='group grid w-full gap-1 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 text-left transition-colors hover:border-ui-primary hover:bg-ui-raised'
        >
            <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ui-muted'>
                {sensitive ? <KeyRound className='h-3 w-3' /> : <Copy className='h-3 w-3' />}
                {label}
            </span>
            <span className='break-all font-mono text-[11px] leading-4 text-ui-text'>
                {sensitive ? '************' : value}
            </span>
        </button>
    )
}
