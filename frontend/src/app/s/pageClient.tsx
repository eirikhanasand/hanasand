'use client'

import { useRef } from 'react'
import randomId from '@/utils/random/randomId'
import SharePageClient from './[...id]/clientPage'

export default function ShareEntryClient() {
    const shareId = useRef(randomId()).current
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
                replaceUrlOnCreate
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
