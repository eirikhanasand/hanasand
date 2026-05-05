import useHideIfLittleSpace from '@/hooks/useHideIfLittleSpace'
import useMovable from '@/hooks/movable'
import { OpenFoldersProvider } from '@/hooks/useFolderState'
import { getCookie } from '@/utils/cookies/cookies'
import { getTree } from '@/utils/share/getTree'
import { Files, Folder, Search, X } from 'lucide-react'
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import TreeHeader from './treeHeader'
import Tree from './tree'
import NewFile from './newFile'
import WorkspaceSearchPanel from '../workspaceSearchPanel'

type ExplorerProps = {
    showExplorer: boolean
    setShowExplorer: Dispatch<SetStateAction<boolean>>
    openFolders: string[]
    tree: Tree | null
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    editingContent: string
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
    setError: Dispatch<SetStateAction<string | boolean | null>>
}

export default function Explorer({
    showExplorer,
    setShowExplorer,
    openFolders,
    tree: serverTree,
    share,
    setShare,
    editingContent,
    setEditorPatch,
    setError,
}: ExplorerProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'left', setHide: setShowExplorer })
    const [activePanel, setActivePanel] = useState<'files' | 'search'>('files')
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
            <div
                onMouseDown={(event) => handleMouseDown(event)}
                className='absolute z-100 grid gap-2 rounded-xl border border-bright/10 bg-dark/20 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl'
                style={{
                    top: position.y,
                    left: position.x,
                }}
            >
                <button
                    type='button'
                    aria-label='Open file explorer'
                    onClick={() => {
                        setActivePanel('files')
                        handleOpen()
                    }}
                    className='group grid h-11 w-11 place-items-center rounded-lg hover:bg-dark'
                >
                    <Folder className='stroke-light/50 group-hover:stroke-bright' />
                </button>
                <button
                    type='button'
                    aria-label='Open workspace search'
                    onClick={() => {
                        setActivePanel('search')
                        handleOpen()
                    }}
                    className='group grid h-11 w-11 place-items-center rounded-lg hover:bg-dark'
                >
                    <Search className='stroke-light/50 group-hover:stroke-bright' />
                </button>
            </div>
        )
    }

    return (
        <div className='flex h-full min-w-fit gap-2'>
            <nav className='flex h-full w-14 shrink-0 flex-col items-center gap-2 rounded-xl border border-bright/10 bg-[#070b10]/80 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl'>
                <button type='button' aria-label='Close left sidebar' onClick={() => setShowExplorer(false)} className='grid h-10 w-10 place-items-center rounded-lg text-bright/55 transition hover:bg-bright/10 hover:text-bright'>
                    <X className='h-5 w-5' />
                </button>
                <button
                    type='button'
                    aria-label='Files'
                    onClick={() => setActivePanel('files')}
                    className={`grid h-10 w-10 place-items-center rounded-lg transition ${activePanel === 'files' ? 'bg-[#e25822]/15 text-[#ffd3bd]' : 'text-bright/55 hover:bg-bright/10 hover:text-bright'}`}
                >
                    <Files className='h-5 w-5' />
                </button>
                <button
                    type='button'
                    aria-label='Search and replace'
                    onClick={() => setActivePanel('search')}
                    className={`grid h-10 w-10 place-items-center rounded-lg transition ${activePanel === 'search' ? 'bg-[#e25822]/15 text-[#ffd3bd]' : 'text-bright/55 hover:bg-bright/10 hover:text-bright'}`}
                >
                    <Search className='h-5 w-5' />
                </button>
            </nav>
            {activePanel === 'search' ? (
                <WorkspaceSearchPanel
                    tree={tree}
                    share={share}
                    editingContent={editingContent}
                    setShare={setShare}
                    setEditorPatch={setEditorPatch}
                    setError={setError}
                />
            ) : (
                <div className='h-full w-[15vw] min-w-60 overflow-auto rounded-xl border border-bright/10 bg-[#070b10]/80 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl'>
                    {(!tree || !share) && <div className='w-full rounded-lg bg-red-500/20 p-2 outline outline-red-500/30'>
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
                                    setShare={setShare}
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
                                setShare={setShare}
                            />
                        </OpenFoldersProvider>
                    )}
                </div>
            )}
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
