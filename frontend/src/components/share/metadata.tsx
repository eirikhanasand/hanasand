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

const sharedStyles = 'absolute bg-dark/10 hover:bg-dark grid place-items-center rounded-lg cursor-move z-100 select-none p-5'
const baseButtonStyle = 'outline outline-dark rounded-lg h-12 w-12 hover:bg-light/50 grid place-items-center cursor-pointer'

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
    const [showGitPlugin, setShowGitPlugin] = useState(false)
    const [showPhoneSimulator, setShowPhoneSimulator] = useState(false)
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

    return (
        <div className={`min-w-0 h-full ${showPhoneSimulator ? 'w-[min(30rem,calc(100vw-1rem))]' : 'w-[min(28rem,calc(100vw-1rem))] lg:w-[min(28rem,24vw)]'}`}>
            <div className='h-full w-full max-w-full space-y-2 overflow-y-auto overflow-x-hidden rounded-xl border border-bright/10 bg-[#070b10]/70 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl'>
                <div className='grid grid-cols-5 gap-2'>
                    <button type='button' aria-label='Close metadata' onClick={() => setShowMetadata(false)} className={baseButtonStyle}>
                        <X className='cursor-pointer' />
                    </button>
                    <Link href={`/s/${share?.id || shareRouteId}`} aria-label='Reload current share workspace' className={baseButtonStyle}>
                        <RefreshCw className='cursor-pointer' />
                    </Link>
                    <button type='button' aria-label='Copy current file contents' onClick={() => copy({ text: editingContent, setDidCopy })} className={baseButtonStyle}>
                        <Copy height={22} width={22} className={didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-bright' : 'stroke-red-500'} />
                    </button>
                    <Lock baseButtonStyle={baseButtonStyle} share={share} setError={setError} />
                    <button type='button' aria-label='Toggle line numbers' onClick={() => setDisplayLineNumbers(prev => !prev)} className={baseButtonStyle}>
                        <ListOrdered height={22} width={22} />
                    </button>
                    <button
                        type='button'
                        aria-label={syntaxHighlighting ? 'Disable syntax highlighting' : 'Enable syntax highlighting'}
                        onClick={() => setSyntaxHighlighting(prev => !prev)}
                        className={`stroke-rgb ${baseButtonStyle}`}
                    >
                        <Highlighter className={!syntaxHighlighting ? 'stroke-rgb' : 'stroke-bright'} height={22} width={22} />
                    </button>
                    <button
                        type='button'
                        aria-label={box ? 'Hide share tool box' : 'Show share tool box'}
                        onClick={() => setBox(prev => !prev)}
                        className={`stroke-rgb ${baseButtonStyle}`}
                    >
                        <Package className={box ? 'stroke-rgb' : 'stroke-bright'} height={22} width={22} />
                    </button>
                    <button
                        type='button'
                        aria-label={showGitPlugin ? 'Hide Git plugin' : 'Show Git plugin'}
                        onClick={() => setShowGitPlugin(prev => !prev)}
                        className={`stroke-rgb ${baseButtonStyle}`}
                    >
                        <GitBranch className={showGitPlugin ? 'stroke-rgb' : 'stroke-bright'} height={22} width={22} />
                    </button>
                    <button
                        type='button'
                        aria-label={showPhoneSimulator ? 'Hide phone simulator' : 'Show phone simulator'}
                        onClick={() => setShowPhoneSimulator(prev => !prev)}
                        className={`stroke-rgb ${baseButtonStyle}`}
                    >
                        <Smartphone className={showPhoneSimulator ? 'stroke-rgb' : 'stroke-bright'} height={22} width={22} />
                    </button>
                </div>
                <Notify message={error} />
                {showGitPlugin ? <GitPlugin shareRouteId={shareRouteId} share={share} /> : null}
                <PhoneSimulator share={share} open={showPhoneSimulator} />
                <Info share={share} isConnected={isConnected} participants={participants} />
                <TerminalAccess
                    status={terminalStatus}
                    credentials={terminalCredentials}
                    setDidCopy={setDidCopy}
                />
                <WordControl clickedWord={clickedWord} />
                <ReferencePanel
                    tree={tree || null}
                    share={share}
                    clickedWord={clickedWord}
                    setClickedWord={setClickedWord}
                    editingContent={editingContent}
                />
                <Box box={box} setBox={setBox} share={share} />
            </div>
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
