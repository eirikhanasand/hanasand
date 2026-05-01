import useHideIfLittleSpace from '@/hooks/useHideIfLittleSpace'
import useMovable from '@/hooks/movable'
import { OpenFoldersProvider } from '@/hooks/useFolderState'
import { getCookie } from '@/utils/cookies/cookies'
import { getTree } from '@/utils/share/getTree'
import { Folder, X } from 'lucide-react'
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import TreeHeader from './treeHeader'
import Tree from './tree'
import NewFile from './newFile'

type ExplorerProps = {
    showExplorer: boolean
    setShowExplorer: Dispatch<SetStateAction<boolean>>
    openFolders: string[]
    tree: Tree | null
    share: Share | null
}

const sharedStyles = 'absolute bg-dark/10 hover:bg-dark grid place-items-center rounded-lg cursor-move z-100 select-none p-5'

export default function Explorer({
    showExplorer,
    setShowExplorer,
    openFolders,
    tree: serverTree,
    share
}: ExplorerProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'left', setHide: setShowExplorer })
    const [isCreatingNewFile, setIsCreatingNewFile] = useState<'file' | 'folder' | null>(null)
    const [newFileName, setNewFileName] = useState('')
    const [selectedFolder, setSelectedFolder] = useState('')
    const [tree, setTree] = useState(serverTree)
    const [treeLoading, setTreeLoading] = useState(false)
    const rootFolder = getProjectRoot(tree, share)
    const visibleTree = rootFolder ? rootFolder.children : tree
    useHideIfLittleSpace({ set: setShowExplorer })

    const recoverTree = useCallback(async (shareId: string) => {
        setTreeLoading(true)
        const userId = getCookie('id') ?? undefined
        const token = getCookie('access_token') ?? undefined
        const nextTree = await getTree({ id: shareId, token, userId })
        setTree(nextTree)
        setTreeLoading(false)
        return nextTree
    }, [])

    useEffect(() => {
        setTree(serverTree)
    }, [serverTree])

    useEffect(() => {
        const shareId = share?.id
        if (tree || !shareId) {
            return
        }
        const currentShareId: string = shareId

        let cancelled = false

        async function recoverTree() {
            const nextTree = await recoverTreeOnce(currentShareId)

            if (!cancelled) {
                setTree(nextTree)
            }
        }

        async function recoverTreeOnce(nextShareId: string) {
            setTreeLoading(true)
            const userId = getCookie('id') ?? undefined
            const token = getCookie('access_token') ?? undefined
            const nextTree = await getTree({ id: nextShareId, token, userId })
            if (!cancelled) {
                setTreeLoading(false)
            }
            return nextTree
        }

        void recoverTree()

        return () => {
            cancelled = true
        }
    }, [share?.id, tree])

    if (!showExplorer) {
        return (
            <button
                type='button'
                aria-label='Open file explorer'
                onMouseDown={(event) => handleMouseDown(event)}
                onClick={handleOpen}
                className={`group ${sharedStyles}`}
                style={{
                    top: position.y,
                    left: position.x,
                }}
            >
                <Folder className='stroke-light/50 group-hover:stroke-bright' />
            </button>
        )
    }

    return (
        <div className='min-w-fit w-[15vw] h-full'>
            <div className='outline outline-dark rounded-lg p-2 h-full space-y-2 overflow-auto'>
                <button
                    type='button'
                    aria-label='Close file explorer'
                    onClick={() => setShowExplorer(false)}
                    className='outline outline-dark rounded-lg hover:bg-dark/50 h-12 w-12 grid place-items-center cursor-pointer'
                >
                    <X className='cursor-pointer' />
                </button>
                {(!tree || !share) && <div className='outline outline-red-500/30 bg-red-500/20 w-full rounded-lg p-2'>
                    <h1 className='text-sm text-bright/85'>
                        {treeLoading && share ? 'Loading file tree...' : 'Unable to load file tree.'}
                    </h1>
                    {!treeLoading && share ? (
                        <button
                            type='button'
                            aria-label='Retry loading file tree'
                            onClick={() => void recoverTree(share.id)}
                            className='mt-3 inline-flex rounded-lg bg-bright/10 px-3 py-2 text-xs font-medium text-bright/85 outline outline-bright/10 transition-colors hover:bg-bright/15'
                        >
                            Retry
                        </button>
                    ) : null}
                </div>}
                {visibleTree && share && (
                    <OpenFoldersProvider serverOpenFolders={openFolders}>
                        <TreeHeader
                            share={share}
                            setIsCreatingNewFile={setIsCreatingNewFile}
                        />
                        {rootFolder && visibleTree.length === 0 && (
                            <NewFile
                                isCreatingNewFile={isCreatingNewFile}
                                display={Boolean(isCreatingNewFile)}
                                newFileName={newFileName}
                                setNewFileName={setNewFileName}
                                setIsCreatingNewFile={setIsCreatingNewFile}
                                file={rootFolder}
                                tree={visibleTree}
                                setTree={setTree}
                            />
                        )}
                        <Tree
                            tree={visibleTree}
                            newFileName={newFileName}
                            setNewFileName={setNewFileName}
                            isCreatingNewFile={isCreatingNewFile}
                            setIsCreatingNewFile={setIsCreatingNewFile}
                            selectedFolder={selectedFolder}
                            setSelectedFolder={setSelectedFolder}
                            setTree={setTree}
                        />
                    </OpenFoldersProvider>
                )}
            </div>
        </div>
    )
}

function getProjectRoot(tree: Tree | null, share: Share | null): FileFolder | null {
    if (!tree || !share || tree.length !== 1) {
        return null
    }

    const [root] = tree
    if (root.type !== 'folder') {
        return null
    }

    if (root.id === share.id || (root.parent === null && root.name.startsWith('project-'))) {
        return root
    }

    return null
}
