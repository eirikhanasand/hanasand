'use client'

import Notify from '@/components/notify/notify'
import Info from '@/components/share/info'
import Lock from '@/components/share/lock'
import WordControl from '@/components/share/wordControl'
import HideIfLittleSpace from '@/hooks/hideIfLittleSpace'
import useMovable from '@/hooks/movable'
import copy from '@/utils/copy'
import randomId from '@/utils/random/randomId'
import { Copy, Eye, Highlighter, Info as InfoIcon, ListOrdered, RefreshCw, X } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'

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
}

const sharedStyles = 'absolute bg-dark/10 hover:bg-dark grid place-items-center rounded-lg cursor-move z-100 select-none p-5'

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
    syntaxHighlighting
}: MetadataProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'right', setHide: setShowMetadata })
    const [id, setId] = useState(randomServerId)
    const [didCopy, setDidCopy] = useState<'error' | boolean>(false)
    const [error, setError] = useState<string | null>(null)
    HideIfLittleSpace({set: setShowMetadata})

    useEffect(() => {
        const random = randomId()
        setId(random)
    }, [])

    useEffect(() => {
        setTimeout(() => {
            setDidCopy(false)
        }, 350)
    }, [didCopy])

    useEffect(() => {
        if (!error) {
            return
        }

        const timeout = setTimeout(() => {
            setError(null)
        }, 5000)

        return () => clearTimeout(timeout)
    }, [error])

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
        <div className='bg-normal min-w-fit w-[10vw] h-full p-2 space-y-2'>
            <div className='grid grid-cols-5 gap-2'>
                <div className='bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'>
                    <X className='cursor-pointer' onClick={() => setShowMetadata(false)} />
                </div>
                <Link href={`/s/${id}`} className='bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'>
                    <RefreshCw className='cursor-pointer' onClick={() => setShowMetadata(false)} />
                </Link>
                <div onClick={() => copy({ text: editingContent, setDidCopy })} className='bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'>
                    <Copy height={22} width={22} className={didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-gray-200' : 'stroke-red-500'} />
                </div>
                <Lock share={share} setError={setError} />
                <div onClick={() => setDisplayLineNumbers(prev => !prev)} className='bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'>
                    <ListOrdered height={22} width={22} />
                </div>
                <div
                    onClick={() => setSyntaxHighlighting(prev => !prev)}
                    className='stroke-rgb bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'
                >
                    <Highlighter className={!syntaxHighlighting ? 'stroke-rgb' : 'stroke-white'} height={22} width={22} />
                </div>
            </div>
            {error && <Notify message={error} />}
            <Info share={share} isConnected={isConnected} participants={participants} />
            <WordControl clickedWord={clickedWord} />
        </div>
    )
}
