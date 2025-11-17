'use client'

import useFolderState from '@/hooks/useFolderState'
import { File, Folder, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import Tree from './tree'
import { Dispatch, SetStateAction } from 'react'
import postShare from '@/utils/share/post'
import randomId from '@/utils/random/randomId'
import { getCookie } from '@/utils/cookies'

type FileNodeProps = {
    file: FileItem
    newFileName: string
    setNewFileName: Dispatch<SetStateAction<string>>
    isCreatingNewFile: 'file' | 'folder' | null
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    setTree: Dispatch<SetStateAction<Tree | null>>
}

export default function FileNode({
    file,
    newFileName,
    setNewFileName,
    isCreatingNewFile,
    setIsCreatingNewFile,
    setTree
}: FileNodeProps) {
    const { isOpen, toggleFolder } = useFolderState()
    const open = isOpen(file.id)
    
    async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        const id = getCookie('id')
        const token = getCookie('access_token')
        if (e.key === 'Enter') {
            const response = await postShare({
                includeTree: true,
                id: randomId(),
                content: '', 
                name: newFileName,
                parent: file.id,
                type: isCreatingNewFile ?? 'file',
                token,
                userId: id
            })

            if (response && ('tree' in response)) {
                setTree(response.tree)
            }
        }
    }

    if (file.type === 'folder') {
        return (
            <li>
                <div
                    onClick={() => toggleFolder(file.id)}
                    className='flex items-center gap-2 cursor-pointer hover:bg-light/70 rounded-md px-2 py-1 text-gray-400 text-sm'
                >
                    {open ? <FolderOpen size={16} /> : <Folder size={16} />}
                    <span>{file.name}</span>
                </div>
                {open && file.children && (
                    <div className='ml-3.5 border-l group-hover:border-gray-400/40 border-transparent'>
                        <Tree
                            tree={file.children}
                            newFileName={newFileName}
                            setNewFileName={setNewFileName}
                            isCreatingNewFile={isCreatingNewFile}
                            setIsCreatingNewFile={setIsCreatingNewFile}
                            setTree={setTree}
                        />
                    </div>
                )}
            </li>
        )
    }

    return (
        <>
            {isCreatingNewFile && <div className='flex items-center gap-2 px-2 py-1 hover:bg-light/70 rounded-md cursor-pointer'>
                {isCreatingNewFile === 'folder'
                    ? <Folder size={14} className='text-gray-400' />
                    : <File size={14} className='text-gray-400' />
                }
                <input
                    autoFocus
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className='text-sm text-gray-400 outline-none'
                    onKeyDown={handleKeyDown}
                />
            </div>}
            <Link href={file.id} className='flex items-center gap-2 px-2 py-1 hover:bg-light/70 rounded-md cursor-pointer'>
                <File size={14} className='text-gray-400' />
                <span className='text-sm text-gray-400'>{file.name}</span>
            </Link>
        </>
    )
}
