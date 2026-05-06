'use client'

import useFolderState from '@/hooks/useFolderState'
import { deleteShare } from '@/utils/share/delete'
import { getShare } from '@/utils/share/get'
import postShare from '@/utils/share/post'
import { updateShare } from '@/utils/share/put'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { Copy, File, FilePlus, Folder, FolderPlus, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import Tree from './tree'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
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
    setShare: Dispatch<SetStateAction<Share | null>>
    rootTree: Tree
    share: Share
    onTreeRefresh: () => Promise<Tree | null>
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
    setShare,
    rootTree,
    share,
    onTreeRefresh,
}: FileNodeProps) {
    const { isOpen, toggleFolder } = useFolderState()
    const [isRenaming, setIsRenaming] = useState(false)
    const [renameValue, setRenameValue] = useState(file.name)
    const [busyAction, setBusyAction] = useState<string | null>(null)
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

    function startCreate(type: 'file' | 'folder') {
        if (file.type === 'folder') {
            setSelectedFolder(file.id)
            if (!open) {
                toggleFolder(file.id)
            }
        } else {
            setSelectedFolder(file.parent || '')
        }
        setIsCreatingNewFile(type)
    }

    async function handleRename() {
        const nextName = renameValue.trim()
        if (!nextName || nextName === file.name) {
            setRenameValue(file.name)
            setIsRenaming(false)
            return
        }

        setBusyAction('rename')
        const updated = await updateShare(file.id, { name: nextName })
        if (updated) {
            await onTreeRefresh()
            setIsRenaming(false)
        } else {
            setRenameValue(file.name)
        }
        setBusyAction(null)
    }

    async function handleDelete() {
        if (!window.confirm(`Delete ${file.name}${file.type === 'folder' ? ' and everything inside it' : ''}?`)) {
            return
        }

        setBusyAction('delete')
        const token = getCookie('access_token')
        const userId = getCookie('id')
        const deleted = await deleteShare(file.id, token, userId)
        if (deleted) {
            await onTreeRefresh()
            if (pathname.includes(`/s/${file.id}`)) {
                window.history.replaceState(window.history.state, '', `/s/${share.alias || share.id}`)
            }
        }
        setBusyAction(null)
    }

    async function handleDuplicate() {
        setBusyAction('duplicate')
        const token = getCookie('access_token')
        const userId = getCookie('id')
        await duplicateTreeItem({
            item: file,
            rootTree,
            parent: file.parent || undefined,
            token,
            userId,
            uniquifyName: true,
        })
        await onTreeRefresh()
        setBusyAction(null)
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
                    className={`group/node flex items-center gap-2 cursor-pointer ${isFolderActive ? 'bg-[#f07d33]/18 outline outline-1 outline-[#f07d33]/35' : 'hover:bg-light/70'} rounded-md px-2 py-1 text-bright/80 text-sm`}
                >
                    {open ? <FolderOpen size={16} /> : <Folder size={16} />}
                    {isRenaming ? (
                        <RenameInput
                            value={renameValue}
                            setValue={setRenameValue}
                            onCancel={() => {
                                setRenameValue(file.name)
                                setIsRenaming(false)
                            }}
                            onSave={handleRename}
                        />
                    ) : (
                        <span className='min-w-0 flex-1 truncate'>{file.name}</span>
                    )}
                    {!isRenaming && <NodeActions
                        busy={Boolean(busyAction)}
                        onCreateFile={() => startCreate('file')}
                        onCreateFolder={() => startCreate('folder')}
                        onRename={() => setIsRenaming(true)}
                        onDuplicate={handleDuplicate}
                        onDelete={handleDelete}
                    />}
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
                        setShare={setShare}
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
                            setShare={setShare}
                            rootTree={rootTree}
                            share={share}
                            onTreeRefresh={onTreeRefresh}
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
                setShare={setShare}
            />
            <div className={`group/node flex items-center gap-2 rounded-md px-2 py-1 ${isActive ? 'bg-[#f07d33]/18 outline outline-1 outline-[#f07d33]/35' : 'hover:bg-light/70'}`}>
                {isRenaming ? (
                    <>
                        <File size={14} className='shrink-0 text-[#f07d33]' />
                        <RenameInput
                            value={renameValue}
                            setValue={setRenameValue}
                            onCancel={() => {
                                setRenameValue(file.name)
                                setIsRenaming(false)
                            }}
                            onSave={handleRename}
                        />
                    </>
                ) : (
                    <Link prefetch={false} href={`/s/${file.id}`} className='flex min-w-0 flex-1 items-center gap-2'>
                        <File size={14} className={`${isActive ? 'text-[#f07d33]' : 'text-bright/80'}`} />
                        <span className={`truncate text-sm ${isActive ? 'font-semibold text-bright' : 'text-bright/80'}`}>{file.name}</span>
                    </Link>
                )}
                {!isRenaming && <NodeActions
                    busy={Boolean(busyAction)}
                    onCreateFile={() => startCreate('file')}
                    onCreateFolder={() => startCreate('folder')}
                    onRename={() => setIsRenaming(true)}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                />}
            </div>
        </>
    )
}

function RenameInput({
    value,
    setValue,
    onSave,
    onCancel,
}: {
    value: string
    setValue: Dispatch<SetStateAction<string>>
    onSave: () => Promise<void>
    onCancel: () => void
}) {
    return (
        <input
            autoFocus
            value={value}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => void onSave()}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    void onSave()
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    onCancel()
                }
            }}
            className='min-w-0 flex-1 rounded border border-[#f07d33]/35 bg-black/25 px-1 text-sm text-bright outline-none'
        />
    )
}

function NodeActions({
    busy,
    onCreateFile,
    onCreateFolder,
    onRename,
    onDuplicate,
    onDelete,
}: {
    busy: boolean
    onCreateFile: () => void
    onCreateFolder: () => void
    onRename: () => void
    onDuplicate: () => void
    onDelete: () => void
}) {
    const buttonClass = 'grid h-6 w-6 place-items-center rounded text-bright/42 opacity-0 transition hover:bg-bright/10 hover:text-bright group-hover/node:opacity-100 focus:opacity-100'

    return (
        <div className='ml-auto flex shrink-0 items-center gap-0.5'>
            <button type='button' aria-label='Create file here' disabled={busy} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onCreateFile() }} className={buttonClass}>
                <FilePlus className='h-3.5 w-3.5' />
            </button>
            <button type='button' aria-label='Create folder here' disabled={busy} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onCreateFolder() }} className={buttonClass}>
                <FolderPlus className='h-3.5 w-3.5' />
            </button>
            <button type='button' aria-label='Rename item' disabled={busy} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onRename() }} className={buttonClass}>
                <Pencil className='h-3.5 w-3.5' />
            </button>
            <button type='button' aria-label='Duplicate item' disabled={busy} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDuplicate() }} className={buttonClass}>
                <Copy className='h-3.5 w-3.5' />
            </button>
            <button type='button' aria-label='Delete item' disabled={busy} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete() }} className={`${buttonClass} hover:text-red-200`}>
                <Trash2 className='h-3.5 w-3.5' />
            </button>
        </div>
    )
}

async function duplicateTreeItem({
    item,
    rootTree,
    parent,
    token,
    userId,
    uniquifyName = false,
}: {
    item: FileItem
    rootTree: Tree
    parent?: string
    token?: string | null
    userId?: string | null
    uniquifyName?: boolean
}) {
    const id = randomId()
    const name = uniquifyName ? uniqueName(item.name, siblingsForParent(rootTree, item.parent)) : item.name
    const content = item.type === 'file'
        ? await getFileContent(item.id, token, userId)
        : ''

    await postShare({
        includeTree: false,
        id,
        content,
        name,
        parent,
        type: item.type,
        token,
        userId,
    })

    if (item.type === 'folder') {
        for (const child of item.children) {
            await duplicateTreeItem({ item: child, rootTree, parent: id, token, userId })
        }
    }
}

async function getFileContent(id: string, token?: string | null, userId?: string | null) {
    const share = await getShare({
        id,
        token: token || undefined,
        userId: userId || undefined,
    })

    return typeof share === 'string' ? '' : share.content
}

function siblingsForParent(tree: Tree, parent: string | null): FileItem[] {
    if (parent === null) {
        return tree
    }

    const folder = findItem(tree, parent)
    return folder?.type === 'folder' ? folder.children : tree
}

function findItem(tree: Tree, id: string): FileItem | null {
    for (const item of tree) {
        if (item.id === id) {
            return item
        }
        if (item.type === 'folder') {
            const found = findItem(item.children, id)
            if (found) {
                return found
            }
        }
    }
    return null
}

function uniqueName(name: string, siblings: FileItem[]) {
    const names = new Set(siblings.map(item => item.name))
    const extensionMatch = name.match(/(\.[^./]+)$/)
    const extension = extensionMatch?.[1] || ''
    const base = extension ? name.slice(0, -extension.length) : name
    let candidate = `${base} copy${extension}`
    let count = 2
    while (names.has(candidate)) {
        candidate = `${base} copy ${count}${extension}`
        count += 1
    }
    return candidate
}
