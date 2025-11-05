'use client'

import Code from '@/components/share/code'
import Terminal from '@/components/share/terminal'
import Deploy from '@/components/share/deploy'
import Explorer from '@/components/share/tree/explorer'
import Metadata from '@/components/share/metadata'
import RenderSite from '@/components/share/renderSite'
import { useState } from 'react'

type ClientPageProps = {
    id: string
    share: Share | null
    randomId: string
    openFolders: string[]
    tree: Tree | null
}

export default function ClientPage({ id, share: serverShare, randomId, openFolders, tree }: ClientPageProps) {
    const [showExplorer, setShowExplorer] = useState(true)
    const [showMetadata, setShowMetaData] = useState(true)
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
    const [clickedWord, setClickedWord] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const [displayLineNumbers, setDisplayLineNumbers] = useState(true)
    const [syntaxHighlighting, setSyntaxHighlighting] = useState(true)
    const [share, setShare] = useState<Share | null>(serverShare)
    const [open, setOpen] = useState(false)
    const [deploying, setDeploying] = useState(false)
    const [renderSite, setRenderSite] = useState(false)

    return (
        <div className='flex w-full h-full max-w-[100vw] p-2 gap-2'>
            <Explorer 
                showExplorer={showExplorer} 
                setShowExplorer={setShowExplorer}
                openFolders={openFolders}
                tree={tree}
                share={share}
            />
            <div className={`flex-1 flex flex-col min-h-full w-full ${showExplorer && showMetadata && 'max-w-[66vw]'} outline outline-dark rounded-lg text-foreground`}>
                <Code
                    id={share?.id || id}
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
            <Terminal share={share} open={open} setOpen={setOpen} />
            <Deploy deploying={deploying} setDeploying={setDeploying} setOpen={setOpen} />
            <RenderSite share={share} renderSite={renderSite} setRenderSite={setRenderSite} />
        </div>
    )
}
