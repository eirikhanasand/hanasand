import useFolderState from '@/hooks/useFolderState'
import { File, Folder, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import Tree from './tree'

export default function FileNode({ file }: { file: FileItem }) {
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
