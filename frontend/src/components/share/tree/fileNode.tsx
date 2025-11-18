'use client'

import useFolderState from '@/hooks/useFolderState'
import { File, Folder, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import Tree from './tree'
import { Dispatch, SetStateAction, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import NewFile from './newFile'

type FileNodeProps = {
    tree: Tree
    file: FileItem
    newFileName: string
    setNewFileName: Dispatch<SetStateAction<string>>
    isCreatingNewFile: 'file' | 'folder' | null
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    selectedFolder: string
    setSelectedFolder: Dispatch<SetStateAction<string>>
    setTree: Dispatch<SetStateAction<Tree | null>>
}

export default function FileNode({
    tree,
    file,
    newFileName,
    setNewFileName,
    isCreatingNewFile,
    setIsCreatingNewFile,
    selectedFolder,
    setSelectedFolder,
    setTree,
}: FileNodeProps) {
    const { isOpen, toggleFolder } = useFolderState()
    const open = isOpen(file.id)
    const pathname = usePathname()
    const isActive = pathname.includes(`/s/${file.id}`)
    const isFolderActive = selectedFolder === file.id
    const isFirstFileInFolder = tree[0].id === file.id
    const firstFileInSelectedFolder = isFirstFileInFolder && selectedFolder === file.parent
    const shouldDisplay = Boolean((!selectedFolder && !file.parent) || (selectedFolder && firstFileInSelectedFolder))

    function handleFolderClick() {
        setSelectedFolder(file.id)
        toggleFolder(file.id)
    }

    useEffect(() => {
        if (isActive && !selectedFolder && file.parent) {
            setSelectedFolder(file.parent)
        }
    }, [])

    useEffect(() => {
        const shouldDisplayNewFile = selectedFolder === file.id
        if (file.type === 'folder' && !open && isCreatingNewFile && shouldDisplayNewFile) {
            handleFolderClick()
        }
    }, [open, isCreatingNewFile, selectedFolder, file])

    if (file.type === 'folder') {
        const hasChildren = Boolean(file.children?.filter((f) => f.type === 'file').length)

        return (
            <li className='space-y-1' onClick={(e) => e.stopPropagation()}>
                <div
                    onClick={handleFolderClick}
                    className={`flex items-center gap-2 cursor-pointer ${isFolderActive ? 'bg-light/70 hover:bg-bright/15' : 'hover:bg-light/70'} rounded-md px-2 py-1 text-bright/80 text-sm`}
                >
                    {open ? <FolderOpen size={16} /> : <Folder size={16} />}
                    <span>{file.name}</span>
                </div>
                {!hasChildren && <div className='ml-3.5 group-hover:bg-light/70 rounded-md'>
                    <NewFile
                        isCreatingNewFile={isCreatingNewFile}
                        display={isFolderActive}
                        newFileName={newFileName}
                        setNewFileName={setNewFileName}
                        setIsCreatingNewFile={setIsCreatingNewFile}
                        file={file}
                        tree={tree}
                        setTree={setTree}
                    />
                </div>}
                {open && file.children && (
                    <div className='ml-3.5'>
                        <Tree
                            tree={file.children}
                            newFileName={newFileName}
                            setNewFileName={setNewFileName}
                            isCreatingNewFile={isCreatingNewFile}
                            setIsCreatingNewFile={setIsCreatingNewFile}
                            selectedFolder={selectedFolder}
                            setSelectedFolder={setSelectedFolder}
                            setTree={setTree}
                        />
                    </div>
                )}
            </li>
        )
    }

    return (
        <>
            <NewFile
                isCreatingNewFile={isCreatingNewFile}
                display={isFirstFileInFolder && shouldDisplay}
                newFileName={newFileName}
                setNewFileName={setNewFileName}
                setIsCreatingNewFile={setIsCreatingNewFile}
                file={file}
                tree={tree}
                setTree={setTree}
            />
            <Link href={file.id} className={`flex items-center gap-2 px-2 py-1 ${isActive ? 'bg-light/70 hover:bg-bright/15' : 'hover:bg-light/70'} rounded-md cursor-pointer`}>
                <File size={14} className='text-bright/80' />
                <span className='text-sm text-bright/80'>{file.name}</span>
            </Link>
        </>
    )
}
