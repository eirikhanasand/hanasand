'use client'

import Notify from '@/components/notify/notify'
import Info from '@/components/share/info'
import Lock from '@/components/share/lock'
import WordControl from '@/components/share/wordControl'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import HideIfLittleSpace from '@/hooks/useHideIfLittleSpace'
import useMovable from '@/hooks/movable'
import copy from '@/utils/copy'
import { Copy, Eye, Highlighter, Info as InfoIcon, ListOrdered, Package, RefreshCw, X } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction } from 'react'
import Box from '../box/box'

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
    editingContent,
    setDisplayLineNumbers,
    setSyntaxHighlighting,
    syntaxHighlighting,
    box,
    setBox
}: MetadataProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'right', setHide: setShowMetadata })
    const { condition: error, setCondition: setError } = useClearStateAfter()
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
        <div className='min-w-fit w-[9vw] h-full'>
            <div className='outline outline-dark space-y-2 h-full p-2 rounded-lg w-full'>
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
                </div>
                <Notify message={error} />
                <Info share={share} isConnected={isConnected} participants={participants} />
                <WordControl clickedWord={clickedWord} />
                <Box box={box} setBox={setBox} share={share} />
            </div>
        </div>
    )
}
