import useFolderState from '@/hooks/useFolderState'
import { countTreeItems } from '@/components/share/workspaceTree'
import { FilePlus, FolderPlus, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { Dispatch, SetStateAction } from 'react'

type TreeHeaderProps = {
    share: Share
    tree: Tree
    refreshing: boolean
    onRefresh: () => void
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    filter: string
    setFilter: Dispatch<SetStateAction<string>>
}

export default function TreeHeader({ share, tree, refreshing, onRefresh, setIsCreatingNewFile, filter, setFilter }: TreeHeaderProps) {
    const { setOpenFolders } = useFolderState()
    const buttonStyle = 'grid h-6 w-6 cursor-pointer place-items-center rounded-md text-ui-muted transition hover:bg-ui-raised hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-50'
    const counts = countTreeItems(tree)
    const canFoldTree = counts.folders > 0

    function handleClick(type: 'file' | 'folder') {
        setIsCreatingNewFile(prev => prev === type ? null : type)
    }

    function expandAll() {
        setOpenFolders(collectFolderIds(tree))
    }

    function collapseAll() {
        setOpenFolders([])
    }

    return (
        <div className='rounded-md p-1 px-2'>
            <div className='flex w-full items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <h1 className='truncate text-sm font-semibold text-ui-text'>{share.alias}</h1>
                    <p className='text-[10px] leading-4 text-ui-muted'>
                        {counts.files} files · {counts.folders} folders
                    </p>
                </div>
                <div className='flex shrink-0 gap-1'>
                    <button type='button' aria-label='Refresh file tree' onClick={onRefresh} disabled={refreshing} className={buttonStyle}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    {canFoldTree ? (
                        <>
                            <button type='button' aria-label='Expand all folders' onClick={expandAll} className={buttonStyle}>
                                <Maximize2 className='h-4 w-4' />
                            </button>
                            <button type='button' aria-label='Collapse all folders' onClick={collapseAll} className={buttonStyle}>
                                <Minimize2 className='h-4 w-4' />
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
            <div className='mt-1 flex justify-end gap-1'>
                <button type='button' aria-label='Create file' onClick={() => handleClick('file')} className={buttonStyle}>
                    <FilePlus className='h-4 w-4' />
                </button>
                <button type='button' aria-label='Create folder' onClick={() => handleClick('folder')} className={buttonStyle}>
                    <FolderPlus className='h-4 w-4' />
                </button>
            </div>
            <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder='Filter files...'
                className='mt-2 w-full rounded-md border border-ui-border bg-ui-raised px-2 py-1.5 text-xs text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary/40'
            />
        </div>
    )
}

function collectFolderIds(tree: Tree) {
    const ids: string[] = []
    for (const file of tree) {
        if (file.type === 'folder') {
            ids.push(file.id, ...collectFolderIds(file.children))
        }
    }
    return ids
}
