import { getCookie } from '@/utils/cookies'
import randomId from '@/utils/random/randomId'
import postShare from '@/utils/share/post'
import { File, Folder } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Dispatch, SetStateAction } from 'react'

type NewFileProps = {
    isCreatingNewFile: 'file' | 'folder' | null
    display: boolean
    newFileName: string
    setNewFileName: Dispatch<SetStateAction<string>>
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    file: FileItem
    setTree: Dispatch<SetStateAction<Tree | null>>
}

export default function NewFile({ 
    isCreatingNewFile, 
    display,
    newFileName,
    setNewFileName,
    setIsCreatingNewFile,
    file,
    setTree
}: NewFileProps) {
    const router = useRouter()
    async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        const id = getCookie('id')
        const token = getCookie('access_token')
        if (e.key === 'Enter') {
            const newFileId = randomId()
            const response = await postShare({
                includeTree: true,
                id: newFileId,
                content: '',
                name: newFileName,
                parent: file.id,
                type: isCreatingNewFile ?? 'file',
                token,
                userId: id
            })
            
            if (response && ('tree' in response)) {
                setIsCreatingNewFile(null)
                setNewFileName('')
                setTree(response.tree)
                router.push(`/s/${newFileId}`)
            }
        }
    }
    
    if (!isCreatingNewFile || !display) {
        return <></>
    }
    
    return (
        <div className='flex items-center gap-2 px-2 py-1 hover:bg-light/70 rounded-md cursor-pointer'>
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
                onBlur={() => setIsCreatingNewFile(null)}
            />
        </div>
    )
}
