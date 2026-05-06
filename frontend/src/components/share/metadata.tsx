'use client'

import Notify from '@/components/notify/notify'
import GitPlugin from '@/components/share/gitPlugin'
import Info from '@/components/share/info'
import Lock from '@/components/share/lock'
import ReferencePanel from '@/components/share/referencePanel'
import WordControl from '@/components/share/wordControl'
import type { TerminalCredentials } from '@/hooks/useTerminal'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import HideIfLittleSpace from '@/hooks/useHideIfLittleSpace'
import useMovable from '@/hooks/movable'
import copy from '@/utils/copy'
import { Copy, Eye, GitBranch, Highlighter, Info as InfoIcon, KeyRound, ListOrdered, Package, RefreshCw, Smartphone, TerminalSquare, X } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useState } from 'react'
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
}

type MetadataPanel = 'info' | 'terminal' | 'symbols' | 'git' | 'phone' | 'box' | null

const sharedStyles = 'absolute bg-background/80 hover:bg-bright/8 grid place-items-center rounded-lg cursor-move z-100 select-none p-5 border border-bright/10 backdrop-blur-md'
const baseButtonStyle = 'grid h-10 w-10 place-items-center rounded-lg text-bright/55 transition hover:bg-bright/10 hover:text-bright'

export default function Metadata({
    shareRouteId,
    share,
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
}: MetadataProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'right', setHide: setShowMetadata })
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [activePanel, setActivePanel] = useState<MetadataPanel>('info')
    HideIfLittleSpace({ set: setShowMetadata })
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 350,
        onClear: () => setDidCopy(false)
    })

    if (!showMetadata) {
        const color = isConnected ? 'stroke-green-600/20 group-hover:stroke-green-600' : 'stroke-extralight'
        return (
            <button
                type='button'
                aria-label='Open share metadata'
                onMouseDown={(event) => handleMouseDown(event)}
                onClick={handleOpen}
                className={`group ${sharedStyles}`}
                style={{ top: position.y, left: position.x }}
            >
                <h1>
                    <InfoIcon className={!isConnected ? color : 'stroke-light/50 group-hover:stroke-bright'} />
                </h1>
                {isConnected && (
                    <h1 className='flex gap-2 text-light/50 group-hover:text-bright'>
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
    const panelTitle = activePanel === 'info'
        ? 'Share details'
        : activePanel === 'terminal'
            ? 'Terminal access'
            : activePanel === 'symbols'
                ? 'Symbols'
                : activePanel === 'git'
                    ? 'Git'
                    : activePanel === 'phone'
                        ? 'Phone preview'
                        : activePanel === 'box'
                            ? 'Tool box'
                            : ''

    return (
        <div className='flex h-full min-w-fit flex-row-reverse gap-2'>
            <nav className='relative z-50 flex h-full w-14 shrink-0 flex-col items-center gap-2 overflow-visible rounded-xl border border-bright/10 bg-background/82 p-2 shadow-2xl shadow-black/20 backdrop-blur-md'>
                <SidebarTooltip label='Close' side='left'>
                    <button type='button' aria-label='Close metadata' onClick={() => setShowMetadata(false)} className={baseButtonStyle}>
                        <X className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Details' side='left'>
                    <button
                        type='button'
                        aria-label='Share details'
                        onClick={() => togglePanel('info')}
                        className={`${baseButtonStyle} ${activePanel === 'info' ? 'bg-[#e25822]/15 text-[#ffd3bd]' : ''}`}
                    >
                        <Eye className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Terminal' side='left'>
                    <button
                        type='button'
                        aria-label='Terminal access'
                        onClick={() => togglePanel('terminal')}
                        className={`${baseButtonStyle} ${activePanel === 'terminal' ? 'bg-[#e25822]/15 text-[#ffd3bd]' : ''}`}
                    >
                        <TerminalSquare className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Symbols' side='left'>
                    <button
                        type='button'
                        aria-label='Symbols'
                        onClick={() => togglePanel('symbols')}
                        className={`${baseButtonStyle} ${activePanel === 'symbols' ? 'bg-[#e25822]/15 text-[#ffd3bd]' : ''}`}
                    >
                        <ListOrdered className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Reload' side='left'>
                    <Link href={`/s/${share?.id || shareRouteId}`} aria-label='Reload current share workspace' className={baseButtonStyle}>
                        <RefreshCw className='h-5 w-5' />
                    </Link>
                </SidebarTooltip>
                <SidebarTooltip label='Copy file' side='left'>
                    <button type='button' aria-label='Copy current file contents' onClick={() => copy({ text: editingContent, setDidCopy })} className={baseButtonStyle}>
                        <Copy height={20} width={20} className={didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-bright' : 'stroke-red-500'} />
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
                        <Highlighter className={!syntaxHighlighting ? 'stroke-rgb' : 'stroke-bright'} height={20} width={20} />
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
                        className={`${baseButtonStyle} ${activePanel === 'box' ? 'bg-[#e25822]/15 text-[#ffd3bd]' : ''}`}
                    >
                        <Package className={activePanel === 'box' ? 'stroke-rgb' : 'stroke-bright'} height={20} width={20} />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Git' side='left'>
                    <button
                        type='button'
                        aria-label='Git plugin'
                        onClick={() => togglePanel('git')}
                        className={`${baseButtonStyle} ${activePanel === 'git' ? 'bg-[#e25822]/15 text-[#ffd3bd]' : ''}`}
                    >
                        <GitBranch className={activePanel === 'git' ? 'stroke-rgb' : 'stroke-bright'} height={20} width={20} />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Phone' side='left'>
                    <button
                        type='button'
                        aria-label='Phone simulator'
                        onClick={() => togglePanel('phone')}
                        className={`${baseButtonStyle} ${activePanel === 'phone' ? 'bg-[#e25822]/15 text-[#ffd3bd]' : ''}`}
                    >
                        <Smartphone className={activePanel === 'phone' ? 'stroke-rgb' : 'stroke-bright'} height={20} width={20} />
                    </button>
                </SidebarTooltip>
            </nav>
            {panelVisible ? (
                <div className={`relative z-10 min-w-0 h-full ${activePanel === 'box'
                    ? 'w-[min(72rem,calc(100vw-5.5rem))] lg:w-[min(72rem,56vw)]'
                    : activePanel === 'phone'
                        ? 'w-[min(30rem,calc(100vw-5.5rem))]'
                        : 'w-[min(24rem,calc(100vw-5.5rem))] lg:w-[min(24rem,21vw)]'
                }`}>
                    <div className='h-full w-full max-w-full space-y-2 overflow-y-auto overflow-x-hidden rounded-xl border border-bright/10 bg-background/82 p-2 shadow-2xl shadow-black/20 backdrop-blur-md'>
                        <header className='flex items-center justify-between rounded-lg border border-bright/8 bg-black/14 px-3 py-2 text-bright/80'>
                            <span className='text-[11px] font-semibold uppercase tracking-[0.22em] text-bright/45'>{panelTitle}</span>
                            <button type='button' aria-label='Hide metadata panel' onClick={() => setActivePanel(null)} className='grid h-8 w-8 place-items-center rounded-lg text-bright/45 transition hover:bg-bright/8 hover:text-bright'>
                                <X className='h-4 w-4' />
                            </button>
                        </header>
                        <Notify message={error} />
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
                    </div>
                </div>
            ) : null}
        </div>
    )
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
        <section className='rounded-lg border border-bright/8 bg-black/16 p-3 text-bright/72'>
            <div className='mb-3 flex items-center gap-2 text-sm font-semibold text-bright/86'>
                <TerminalSquare className='h-4 w-4' />
                Terminal access
            </div>
            <div className='mb-3 flex items-start gap-2 rounded-lg bg-bright/5 px-2.5 py-2 text-xs leading-4 text-bright/62'>
                <span className='mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#9de18f]' />
                <span>{status || 'Waiting for terminal status...'}</span>
            </div>

            {credentials ? (
                <div className='space-y-2 text-xs'>
                    <CredentialRow label='User' value={credentials.username} setDidCopy={setDidCopy} />
                    <CredentialRow label='Password' value={credentials.password} sensitive setDidCopy={setDidCopy} />
                    <CredentialRow label='SSH' value={credentials.sshCommand} setDidCopy={setDidCopy} />
                    <CredentialRow label='Domain' value={credentials.domain} setDidCopy={setDidCopy} />
                </div>
            ) : (
                <div className='rounded-lg border border-bright/8 bg-black/18 px-2.5 py-2 text-xs leading-5 text-bright/48'>
                    Credentials appear here when the VM is reachable.
                </div>
            )}
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
            className='group grid w-full gap-1 rounded-lg bg-bright/4 px-2.5 py-2 text-left outline outline-bright/6 transition-colors hover:bg-bright/8'
        >
            <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-bright/36'>
                {sensitive ? <KeyRound className='h-3 w-3' /> : <Copy className='h-3 w-3' />}
                {label}
            </span>
            <span className='break-all font-mono text-[11px] leading-4 text-bright/74 group-hover:text-bright'>
                {value}
            </span>
        </button>
    )
}
