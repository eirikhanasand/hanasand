'use client'

import { Dispatch, SetStateAction } from 'react'
import FileNode from './fileNode'

type TreeProps = {
    tree: Tree
    newFileName: string
    setNewFileName: Dispatch<SetStateAction<string>>
    isCreatingNewFile: 'file' | 'folder' | null
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    setTree: Dispatch<SetStateAction<Tree | null>>
}

export default function Tree({
    tree,
    setTree,
    newFileName,
    setNewFileName,
    isCreatingNewFile,
    setIsCreatingNewFile
}: TreeProps) {
    return (
        <ul className='group space-y-1'>
            {tree.map((file) => (
                <FileNode
                    tree={tree}
                    key={file.id}
                    file={file}
                    newFileName={newFileName}
                    setNewFileName={setNewFileName}
                    isCreatingNewFile={isCreatingNewFile}
                    setIsCreatingNewFile={setIsCreatingNewFile}
                    setTree={setTree}
                />
            ))}
        </ul>
    )
}
