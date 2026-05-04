'use client'

import { useEffect, useState } from 'react'
import randomId from '@/utils/random/randomId'
import SharePageClient from './[...id]/clientPage'

export default function ShareEntryClient() {
    const [shareId, setShareId] = useState<string | null>(null)

    useEffect(() => {
        setShareId(randomId())
    }, [])

    if (!shareId) {
        return (
            <div className='grid h-[92.5vh] w-full place-items-center'>
                <div className='rounded-2xl border border-bright/10 bg-[#070b10]/80 px-6 py-5 text-center shadow-2xl shadow-black/30 backdrop-blur-xl'>
                    <h1 className='text-sm font-semibold text-bright/85'>Preparing workspace...</h1>
                    <p className='mt-2 text-xs text-bright/45'>Hanasand is opening a fresh share.</p>
                </div>
            </div>
        )
    }

    const share = createOptimisticShare(shareId)
    const tree = createOptimisticTree(shareId)

    return (
        <div className='w-full h-[92.5vh]'>
            <SharePageClient
                id={shareId}
                share={share}
                openFolders={[]}
                tree={tree}
                sharePageWidth={0}
                shareTerminalHeight={0}
                serverOpenFiles={[]}
                autoCreate
                replaceUrlOnCreate={false}
            />
        </div>
    )
}

function createOptimisticShare(id: string): Share {
    return {
        id,
        path: id,
        content: '',
        wordCount: 0,
        estimatedMinutes: 0,
        timestamp: new Date().toISOString(),
        git: null,
        locked: false,
        owner: '',
        parent: '',
        alias: id,
    }
}

function createOptimisticTree(id: string): Tree {
    return [{
        id,
        type: 'folder',
        name: id,
        alias: id,
        parent: null,
        children: [],
    }]
}
