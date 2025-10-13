'use client'

import Code from '@/components/s/code'
import Header from '@/components/s/header'
import useMovable from '@/hooks/movable'
import { Eye, Files, FileText, Folder, Info, X } from 'lucide-react'
import { Dispatch, SetStateAction, useState } from 'react'

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
}

const sharedStyles = 'absolute bg-dark/10 hover:bg-dark grid place-items-center rounded-lg cursor-move z-100 select-none p-5'

export default function ClientPage({ id }: { id: string }) {
    const [showExplorer, setShowExplorer] = useState(true)
    const [showMetadata, setShowMetaData] = useState(true)
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
    const [clickedWord, setClickedWord] = useState<string | null>(null)
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
                    share={share}
                    setShare={setShare}
                    setClickedWord={setClickedWord}
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

function Metadata({ share, isConnected, showMetadata, setShowMetadata, participants, clickedWord }: MetadataProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'right', setHide: setShowMetadata })

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
                    <Info className={!isConnected ? color : 'stroke-light/50 group-hover:stroke-bright'} />
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
        <div className='bg-normal w-[15vw] h-full p-2 space-y-2'>
            <div className='bg-light rounded-lg hover:bg-light/50 h-12 w-12 grid place-items-center cursor-pointer'>
                <X className='cursor-pointer' onClick={() => setShowMetadata(false)} />
            </div>
            <Header share={share} isConnected={isConnected} participants={participants} />
        </div>
    )
}
