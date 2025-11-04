import HideIfLittleSpace from '@/hooks/hideIfLittleSpace'
import useMovable from '@/hooks/movable'
import useFolderState, { OpenFoldersProvider } from '@/hooks/useFolderState'
import { File, Folder, FolderOpen, X } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useState } from 'react'
import TreeHeader from './treeHeader'

type ExplorerProps = {
    showExplorer: boolean
    setShowExplorer: Dispatch<SetStateAction<boolean>>
    openFolders: string[]
    tree: Tree | null
    share: Share | null
}

const sharedStyles = 'absolute bg-dark/10 hover:bg-dark grid place-items-center rounded-lg cursor-move z-100 select-none p-5'

export default function Explorer({ showExplorer, setShowExplorer, openFolders, tree: serverTree, share }: ExplorerProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'left', setHide: setShowExplorer })
    const [tree, setTree] = useState(serverTree)
    HideIfLittleSpace({ set: setShowExplorer })

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
        <div className='bg-normal min-w-fit w-[15vw] h-full p-2 space-y-2'>
            <div className='bg-light rounded-lg hover:bg-dark/50 h-12 w-12 grid place-items-center cursor-pointer'>
                <X className='cursor-pointer' onClick={() => setShowExplorer(false)} />
            </div>
            {(!tree || !share) && <div className='bg-red-500/50 w-full rounded-lg p-2'>
                <h1 className='text-sm'>Unable to load file tree.</h1>
            </div>}
            {tree && share && <OpenFoldersProvider serverOpenFolders={openFolders}>
                <TreeHeader share={share} />
                <Tree tree={tree} />
            </OpenFoldersProvider>}
        </div>
    )
}

function Tree({ tree }: { tree: Tree }) {
    return (
        <ul className='group space-y-1'>
            {tree.map((file) => (
                <FileNode key={file.id} file={file} />
            ))}
        </ul>
    )
}

function FileNode({ file }: { file: FileItem }) {
    const { isOpen, toggleFolder } = useFolderState()
    const open = isOpen(file.id)

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
                        <Tree tree={file.children} />
                    </div>
                )}
            </li>
        )
    }

    return (
        <Link href={file.id} className='flex items-center gap-2 px-2 py-1 hover:bg-light/70 rounded-md cursor-pointer'>
            <File size={14} className='text-gray-400' />
            <span className='text-sm text-gray-400'>{file.name}</span>
        </Link>
    )
}
