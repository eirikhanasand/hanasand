'use client'

import { Dispatch, SetStateAction } from 'react'
import FileNode from './fileNode'

type TreeProps = {
    tree: Tree
    newFileName: string
    setNewFileName: Dispatch<SetStateAction<string>>
    isCreatingNewFile: 'file' | 'folder' | null
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    selectedFolder: string
    setSelectedFolder: Dispatch<SetStateAction<string>>
    setTree: Dispatch<SetStateAction<Tree | null>>
    setShare: Dispatch<SetStateAction<Share | null>>
    rootTree: Tree
    share: Share
    onTreeRefresh: () => Promise<Tree | null>
}

export default function Tree({
    tree,
    setTree,
    newFileName,
    setNewFileName,
    isCreatingNewFile,
    selectedFolder,
    setSelectedFolder,
    setIsCreatingNewFile,
    setShare,
    rootTree,
    share,
    onTreeRefresh,
}: TreeProps) {
    return (
        <ul onClick={() => setSelectedFolder('')} className='group space-y-1 h-[86%]'>
            {tree.map((file) => (
                <FileNode
                    tree={tree}
                    key={file.id}
                    file={file}
                    newFileName={newFileName}
                    setNewFileName={setNewFileName}
                    isCreatingNewFile={isCreatingNewFile}
                    setIsCreatingNewFile={setIsCreatingNewFile}
                    selectedFolder={selectedFolder}
                    setSelectedFolder={setSelectedFolder}
                    setTree={setTree}
                    setShare={setShare}
                    rootTree={rootTree}
                    share={share}
                    onTreeRefresh={onTreeRefresh}
                />
            ))}
        </ul>
    )
}
