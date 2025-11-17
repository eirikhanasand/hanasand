import { getCookie } from '@/utils/cookies'
import randomId from '@/utils/random/randomId'
import postShare from '@/utils/share/post'
import { File, Folder } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Dispatch, SetStateAction } from 'react'
import NewFileWarning from './newFileWarning'
import useClearStateAfter from '@/hooks/useClearStateAfter'

type NewFileProps = {
    isCreatingNewFile: 'file' | 'folder' | null
    display: boolean
    newFileName: string
    setNewFileName: Dispatch<SetStateAction<string>>
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    file: FileItem
    tree: Tree
    setTree: Dispatch<SetStateAction<Tree | null>>
}

export default function NewFile({ 
    isCreatingNewFile, 
    display,
    newFileName,
    setNewFileName,
    setIsCreatingNewFile,
    file,
    tree,
    setTree
}: NewFileProps) {
    const router = useRouter()
    let lowercaseTreeHasFile = false
    const { condition: blink, setCondition: setBlink } = useClearStateAfter({ timeout: 400 })
    const treeHasFile = tree.some((file) => {
        if (file.name.toLowerCase() === newFileName.toLowerCase()) {
            lowercaseTreeHasFile = true
        }

        return file.name === newFileName
    })

    const outline = treeHasFile 
        ? `outline outline-red-500 rounded-md ${blink && 'bg-red-500/20'}`
        : lowercaseTreeHasFile
            ? 'outline outline-yellow-500 rounded-md'
            : 'outline-none'

    async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        const id = getCookie('id')
        const token = getCookie('access_token')
        if (e.key === 'Enter') {
            if (treeHasFile) {
                setBlink(true)
                return
            }

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
        <div className={`flex items-center gap-2 px-2 py-1 hover:bg-light/70 ${outline} rounded-md cursor-pointer relative`}>
            {isCreatingNewFile === 'folder'
                ? <Folder size={14} className='text-bright/80' />
                : <File size={14} className='text-bright/80' />
            }
            <input
                autoFocus
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className='text-sm text-bright/80 outline-none'
                onKeyDown={handleKeyDown}
                onBlur={() => setIsCreatingNewFile(null)}
            />
            <NewFileWarning
                treeHasFile={treeHasFile}
                lowercaseTreeHasFile={lowercaseTreeHasFile}
            />
        </div>
    )
}
