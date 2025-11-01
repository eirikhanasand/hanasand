'use client'

import Code from '@/components/share/code'
import Explorer from '@/components/share/explorer'
import Metadata from '@/components/share/metadata'
import { useState } from 'react'

export default function ClientPage({ id, randomId, openFolders }: { id: string, randomId: string, openFolders: string[] }) {
    const [showExplorer, setShowExplorer] = useState(true)
    const [showMetadata, setShowMetaData] = useState(true)
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
    const [clickedWord, setClickedWord] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const [displayLineNumbers, setDisplayLineNumbers] = useState(true)
    const [syntaxHighlighting, setSyntaxHighlighting] = useState(true)
    const [share, setShare] = useState<Share | null>(null)

    return (
        <div className='flex w-full h-full max-w-[100vw]'>
            <Explorer showExplorer={showExplorer} setShowExplorer={setShowExplorer} openFolders={openFolders} />
            <div className={`flex-1 flex flex-col min-h-full w-full ${showExplorer && showMetadata && 'max-w-[66vw]'} bg-light text-foreground`}>
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
                    syntaxHighlighting={syntaxHighlighting}
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
                syntaxHighlighting={syntaxHighlighting}
                setSyntaxHighlighting={setSyntaxHighlighting}
            />
        </div>
    )
}
