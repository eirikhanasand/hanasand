import HideIfLittleSpace from '@/hooks/hideIfLittleSpace'
import useMovable from '@/hooks/movable'
import useFolderState, { OpenFoldersProvider } from '@/hooks/useFolderState'
import { File, Folder, FolderOpen, X } from 'lucide-react'
import Link from 'next/link'
import { Dispatch, SetStateAction, useState } from 'react'

type ExplorerProps = {
    showExplorer: boolean
    setShowExplorer: Dispatch<SetStateAction<boolean>>
    openFolders: string[]
}

const sharedStyles = 'absolute bg-dark/10 hover:bg-dark grid place-items-center rounded-lg cursor-move z-100 select-none p-5'

export default function Explorer({ showExplorer, setShowExplorer, openFolders }: ExplorerProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'left', setHide: setShowExplorer })
    HideIfLittleSpace({ set: setShowExplorer })
    const [files] = useState(sampleFiles)

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
            <OpenFoldersProvider serverOpenFolders={openFolders}>
                <FileTree files={files} />
            </OpenFoldersProvider>
        </div>
    )
}

function FileTree({ files }: { files: FileItem[] }) {
    return (
        <ul className='group space-y-1'>
            {files.map((file) => (
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
                        <FileTree files={file.children} />
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

const sampleFiles: FileItem[] = [
    {
        id: '1',
        name: 'src',
        type: 'folder',
        children: [
            {
                id: '2',
                name: 'components',
                type: 'folder',
                children: [
                    { id: '3', name: 'Header.tsx', type: 'file' },
                    {
                        id: '26',
                        name: 'components',
                        type: 'folder',
                        children: [
                            { id: '3', name: 'Header.tsx', type: 'file' },
                            {
                                id: '26',
                                name: 'components',
                                type: 'folder',
                                children: [
                                    { id: '3', name: 'Header.tsx', type: 'file' },
                                    {
                                        id: '26',
                                        name: 'components',
                                        type: 'folder',
                                        children: [
                                            { id: '3', name: 'Header.tsx', type: 'file' },
                                            {
                                                id: '2',
                                                name: 'components',
                                                type: 'folder',
                                                children: [
                                                    { id: '3', name: 'Header.tsx', type: 'file' },
                                                    {
                                                        id: '26',
                                                        name: 'components',
                                                        type: 'folder',
                                                        children: [
                                                            { id: '3', name: 'Header.tsx', type: 'file' },
                                                            {
                                                                id: '26',
                                                                name: 'components',
                                                                type: 'folder',
                                                                children: [
                                                                    { id: '3', name: 'Header.tsx', type: 'file' },
                                                                    {
                                                                        id: '26',
                                                                        name: 'components',
                                                                        type: 'folder',
                                                                        children: [
                                                                            { id: '3', name: 'Header.tsx', type: 'file' },
                                                                            { id: '4', name: 'Footer.tsx', type: 'file' },
                                                                        ],
                                                                    },
                                                                ],
                                                            },
                                                        ],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                id: '5',
                name: 'pages',
                type: 'folder',
                children: [
                    { id: '6', name: 'index.tsx', type: 'file' },
                    { id: '7', name: 'about.tsx', type: 'file' },
                ],
            },
        ],
    },
    {
        id: '8',
        name: 'package.json',
        type: 'file',
    },
    {
        id: '9',
        name: 'README.md',
        type: 'file',
    },
]
