'use client'

import Notify from '@/components/notify/notify'
import Info from '@/components/share/info'
import Lock from '@/components/share/lock'
import WordControl from '@/components/share/wordControl'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import HideIfLittleSpace from '@/hooks/useHideIfLittleSpace'
import useMovable from '@/hooks/movable'
import copy from '@/utils/copy'
import randomId from '@/utils/random/randomId'
import { Copy, Eye, Highlighter, Info as InfoIcon, ListOrdered, Package, RefreshCw, X } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import Box from '../box/box'

type MetadataProps = {
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    isConnected: boolean
    showMetadata: boolean
    setShowMetadata: Dispatch<SetStateAction<boolean>>
    participants: number
    clickedWord: string | null
    setClickedWord: Dispatch<SetStateAction<string | null>>
    randomServerId: string
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
    share,
    isConnected,
    showMetadata,
    setShowMetadata,
    participants,
    clickedWord,
    randomServerId,
    editingContent,
    setDisplayLineNumbers,
    setSyntaxHighlighting,
    syntaxHighlighting,
    box,
    setBox
}: MetadataProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'right', setHide: setShowMetadata })
    const [id, setId] = useState(randomServerId)
    const [didCopy, setDidCopy] = useState<string | boolean>(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    HideIfLittleSpace({ set: setShowMetadata })

    useEffect(() => {
        const random = randomId()
        setId(random)
    }, [])

    useEffect(() => {
        setTimeout(() => {
            setDidCopy(false)
        }, 350)
    }, [didCopy])

    if (!showMetadata) {
        const color = isConnected ? 'stroke-green-600/20 group-hover:stroke-green-600' : 'stroke-extralight'
        return (
            <div
                onMouseDown={handleMouseDown}
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
            </div>
        )
    }

    return (
        <div className='min-w-fit w-[9vw] h-full'>
            <div className='outline outline-dark space-y-2 h-full p-2 rounded-lg w-full'>
                <div className='grid grid-cols-5 gap-2'>
                    <div className={baseButtonStyle}>
                        <X className='cursor-pointer' onClick={() => setShowMetadata(false)} />
                    </div>
                    <Link href={`/s/${id}`} className={baseButtonStyle}>
                        <RefreshCw className='cursor-pointer' onClick={() => setShowMetadata(false)} />
                    </Link>
                    <div onClick={() => copy({ text: editingContent, setDidCopy })} className={baseButtonStyle}>
                        <Copy height={22} width={22} className={didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-bright' : 'stroke-red-500'} />
                    </div>
                    <Lock baseButtonStyle={baseButtonStyle} share={share} setError={setError} />
                    <div onClick={() => setDisplayLineNumbers(prev => !prev)} className={baseButtonStyle}>
                        <ListOrdered height={22} width={22} />
                    </div>
                    <div
                        onClick={() => setSyntaxHighlighting(prev => !prev)}
                        className={`stroke-rgb ${baseButtonStyle}`}
                    >
                        <Highlighter className={!syntaxHighlighting ? 'stroke-rgb' : 'stroke-bright'} height={22} width={22} />
                    </div>
                    <div
                        onClick={() => setBox(prev => !prev)}
                        className={`stroke-rgb ${baseButtonStyle}`}
                    >
                        <Package className={box ? 'stroke-rgb' : 'stroke-bright'} height={22} width={22} />
                    </div>
                </div>
                <Notify message={error} />
                <Info share={share} isConnected={isConnected} participants={participants} />
                <WordControl clickedWord={clickedWord} />
                <Box box={box} setBox={setBox} />
            </div>
        </div>
    )
}
