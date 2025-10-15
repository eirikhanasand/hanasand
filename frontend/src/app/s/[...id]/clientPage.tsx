'use client'

import Code from '@/components/s/code'
import Info from '@/components/s/info'
import useMovable from '@/hooks/movable'
import { getCookie } from '@/utils/cookies'
import copy from '@/utils/copy'
import randomId from '@/utils/random/randomId'
import { lockShare } from '@/utils/share/lockShare'
import { Copy, Eye, Folder, Info as InfoIcon, ListOrdered, LockKeyhole, LockKeyholeOpen, RefreshCw, X } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'

type ExplorerProps = {
    showExplorer: boolean
    setShowExplorer: Dispatch<SetStateAction<boolean>>
}

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
}

const sharedStyles = 'absolute bg-dark/10 hover:bg-dark grid place-items-center rounded-lg cursor-move z-100 select-none p-5'

export default function ClientPage({ id, randomId }: { id: string, randomId: string }) {
    const [showExplorer, setShowExplorer] = useState(true)
    const [showMetadata, setShowMetaData] = useState(true)
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
    const [clickedWord, setClickedWord] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const [displayLineNumbers, setDisplayLineNumbers] = useState(true)
    const [share, setShare] = useState<Share | null>(null)

    return (
        <div className="flex w-full h-full bg-gray-100">
            <Explorer showExplorer={showExplorer} setShowExplorer={setShowExplorer} />
            <div className='flex-1 flex flex-col h-full w-full bg-light text-white'>
                <Code
                    id={id}
                    setParticipants={setParticipants}
                    isConnected={isConnected}
                    setIsConnected={setIsConnected}
                    editingContent={editingContent}
                    setEditingContent={setEditingContent}
                    share={share}
                    setShare={setShare}
                    setClickedWord={setClickedWord}
                    displayLineNumbers={displayLineNumbers}
                />
            </div>
            <Metadata
                share={share}
                setShare={setShare}
                isConnected={isConnected}
                showMetadata={showMetadata}
                setShowMetadata={setShowMetaData}
                participants={participants}
                clickedWord={clickedWord}
                setClickedWord={setClickedWord}
                randomServerId={randomId}
                editingContent={editingContent}
                setDisplayLineNumbers={setDisplayLineNumbers}
            />
        </div>
    )
}


function Explorer({ showExplorer, setShowExplorer }: ExplorerProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'left', setHide: setShowExplorer })

    if (!showExplorer) {
        return (
            <div
                onMouseDown={handleMouseDown}
                onClick={handleOpen}
                className={`group ${sharedStyles}`}
                style={{
                    top: position.y,
                    left: position.x,
                }}
            >
                <h1><Folder className='stroke-light/50 group-hover:stroke-bright' /></h1>
            </div>
        )
    }

    return (
        <div className='bg-normal w-[15vw] h-full p-2'>
            <div className='bg-light rounded-lg hover:bg-dark/50 h-12 w-12 grid place-items-center cursor-pointer'>
                <X className='cursor-pointer' onClick={() => setShowExplorer(false)} />
            </div>
        </div>
    )
}

function Metadata({
    share,
    isConnected,
    showMetadata,
    setShowMetadata,
    participants,
    clickedWord,
    randomServerId,
    editingContent,
    setDisplayLineNumbers
}: MetadataProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'right', setHide: setShowMetadata })
    const [id, setId] = useState(randomServerId)
    const [didCopy, setDidCopy] = useState<'error' | boolean>(false)
    const [error, setError] = useState<string | null>(null)

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
        setTimeout(() => {
            setError(null)
        }, 5000)
    }, [error])

    if (!showMetadata) {
        const color = isConnected ? 'stroke-green-600/20 group-hover:stroke-green-600' : 'stroke-extralight'
        return (
            <div
                onMouseDown={handleMouseDown}
                onClick={handleOpen}
                className={`group ${sharedStyles}`}
                style={{
                    top: position.y,
                    left: position.x,
                }}
            >
                <h1>
                    <InfoIcon className={!isConnected ? color : 'stroke-light/50 group-hover:stroke-bright'} />
                </h1>
                {isConnected && (
                    <h1 className="flex gap-2 text-light/50 group-hover:text-bright">
                        {participants}
                        <Eye className={color} />
                    </h1>
                )}
            </div>
        )
    }

    return (
        <div className='bg-normal w-[18rem] h-full p-2 space-y-2'>
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
            </div>
            {error && <div className='bg-light px-4 py-2 shadow-md rounded-lg'>
                <h1>{error}</h1>
                <div className='h-1 bg-red-500 w-0 my-1 animate-slide-line rounded-lg' />
            </div>}
            <Info share={share} isConnected={isConnected} participants={participants} />
            <WordControl clickedWord={clickedWord} />
        </div>
    )
}

function Lock({ share, setError }: { share: Share | null, setError: Dispatch<SetStateAction<string | null>> }) {
    const [locked, setLocked] = useState(share?.locked)

    async function handleLock() {
        const name = getCookie('name')
        if (!name) {
            return setError(`Login required.`)
        }

        const response = await lockShare(share!, name)
        if (response) {
            setLocked(response.locked)
        } else {
            setError(`Failed to ${locked ? 'unlock' : 'lock'} share.`)
        }
    }

    useEffect(() => {
        setLocked(share?.locked || false)
    }, [share])

    if (!share) {
        return (
            <div className='bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'>
                <LockKeyholeOpen height={22} width={22} />
            </div>
        )
    }

    return (
        <div onClick={handleLock} className='bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'>
            {locked ? <LockKeyhole height={22} width={22} /> : <LockKeyholeOpen height={22} width={22} />}
        </div>
    )
}

function WordControl({ clickedWord }: { clickedWord: string | null }) {

    if (!clickedWord) {
        return <></>
    }

    return (
        <div className='bg-light p-4 flex justify-between items-center shadow-md rounded-lg'>
            <h1>{clickedWord}</h1>
        </div>
    )
}
