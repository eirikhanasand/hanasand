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
import SidebarTooltip from '../sidebarTooltip'
import ErrorNotice from '@/components/error/errorNotice'
import { getWorkspaceRoot } from '../workspaceTree'

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
    setPageTree: Dispatch<SetStateAction<Tree | null>>
    panelRequest?: { panel: 'files' | 'search'; nonce: number } | null
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
    setPageTree,
    panelRequest,
}: ExplorerProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'left', setHide: setShowExplorer })
    const [activePanel, setActivePanel] = useState<'files' | 'search'>('files')
    const [isCreatingNewFile, setIsCreatingNewFile] = useState<'file' | 'folder' | null>(null)
    const [newFileName, setNewFileName] = useState('')
    const [selectedFolder, setSelectedFolder] = useState('')
    const [tree, setTree] = useState(serverTree)
    const [treeLoading, setTreeLoading] = useState(false)
    const [filter, setFilter] = useState('')
    const rootFolder = getProjectRoot(tree, share)
    const visibleTree = rootFolder ? rootFolder.children : tree
    const filteredTree = filter.trim() && visibleTree ? filterTree(visibleTree, filter) : visibleTree
    useHideIfLittleSpace({ set: setShowExplorer })

    const setSyncedTree: Dispatch<SetStateAction<Tree | null>> = useCallback((value) => {
        setTree((current) => {
            return typeof value === 'function'
                ? (value as (previous: Tree | null) => Tree | null)(current)
                : value
        })
    }, [])

    const recoverTree = useCallback(async (shareId: string) => {
        setTreeLoading(true)
        try {
            const userId = getCookie('id') ?? undefined
            const token = getCookie('access_token') ?? undefined
            const nextTree = await getTree({ id: shareId, token, userId })
            setSyncedTree(nextTree)
            return nextTree
        } finally {
            setTreeLoading(false)
        }
    }, [setSyncedTree])

    useEffect(() => {
        setTree(serverTree)
    }, [serverTree])

    useEffect(() => {
        setPageTree(tree)
    }, [setPageTree, tree])

    useEffect(() => {
        if (!panelRequest) {
            return
        }

        setActivePanel(panelRequest.panel)
        setShowExplorer(true)
    }, [panelRequest?.nonce, setShowExplorer])

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
                setSyncedTree(nextTree)
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
    }, [share?.id, setSyncedTree, tree])

    if (!showExplorer) {
        return (
            <div
                onMouseDown={(event) => handleMouseDown(event)}
                className='absolute z-100 grid gap-2 rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-lg shadow-ui-canvas/10 backdrop-blur-md max-md:bottom-16 max-md:left-2 max-md:top-auto md:bg-ui-panel/90'
                style={{
                    top: position.y,
                    left: position.x,
                }}
            >
                <SidebarTooltip label='Files'>
                    <button
                        type='button'
                        aria-label='Open file explorer'
                        onClick={() => {
                            setActivePanel('files')
                            handleOpen()
                        }}
                        className='group grid h-11 w-11 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                    >
                        <Folder />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Search'>
                    <button
                        type='button'
                        aria-label='Open workspace search'
                        onClick={() => {
                            setActivePanel('search')
                            handleOpen()
                        }}
                        className='group grid h-11 w-11 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                    >
                        <Search />
                    </button>
                </SidebarTooltip>
            </div>
        )
    }

    return (
        <div className='fixed inset-y-2 left-2 z-[120] flex min-w-0 gap-2 md:relative md:inset-auto md:z-auto md:h-full md:min-w-fit'>
            <nav className='relative z-50 flex h-full w-14 shrink-0 flex-col items-center gap-2 overflow-visible rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-lg shadow-ui-canvas/10 backdrop-blur-md md:bg-ui-panel/90'>
                <SidebarTooltip label='Close'>
                    <button type='button' aria-label='Close left sidebar' onClick={() => setShowExplorer(false)} className='grid h-10 w-10 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>
                        <X className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Files'>
                    <button
                        type='button'
                        aria-label='Files'
                        onClick={() => {
                            if (activePanel === 'files') {
                                setShowExplorer(false)
                                return
                            }
                            setActivePanel('files')
                        }}
                        className={`grid h-10 w-10 place-items-center rounded-lg transition ${activePanel === 'files' ? 'bg-ui-primary/10 text-ui-primary hover:bg-ui-primary/15' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}
                    >
                        <Files className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Search'>
                    <button
                        type='button'
                        aria-label='Search and replace'
                        onClick={() => {
                            if (activePanel === 'search') {
                                setShowExplorer(false)
                                return
                            }
                            setActivePanel('search')
                        }}
                        className={`grid h-10 w-10 place-items-center rounded-lg transition ${activePanel === 'search' ? 'bg-ui-primary/10 text-ui-primary hover:bg-ui-primary/15' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}
                    >
                        <Search className='h-5 w-5' />
                    </button>
                </SidebarTooltip>
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
                <div className='relative z-10 h-full w-[min(18rem,calc(100vw-5rem))] overflow-auto rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-lg shadow-ui-canvas/10 backdrop-blur-md md:w-[15vw] md:min-w-60 md:bg-ui-panel/90'>
                    {(!tree || !share) && <div className='w-full'>
                        {treeLoading || !share ? <TreeSkeleton /> : null}
                        {share && !treeLoading ? (
                            <ErrorNotice
                                compact
                                message='Unable to load file tree.'
                                title='File tree unavailable'
                                actionLabel='Retry'
                                onAction={() => void recoverTree(share.id)}
                            />
                        ) : null}
                    </div>}
                    {visibleTree && share && (
                        <OpenFoldersProvider serverOpenFolders={openFolders}>
                            <TreeHeader
                                share={share}
                                tree={visibleTree}
                                refreshing={treeLoading}
                                onRefresh={() => void recoverTree(share.id)}
                                setIsCreatingNewFile={setIsCreatingNewFile}
                                filter={filter}
                                setFilter={setFilter}
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
                                    setTree={setSyncedTree}
                                    setShare={setShare}
                                />
                            )}
                            {filteredTree && filteredTree.length === 0 && filter.trim() ? (
                                <div className='px-2 py-4 text-xs text-ui-muted'>No files match "{filter.trim()}".</div>
                            ) : null}
                            <Tree
                                tree={filteredTree || []}
                                newFileName={newFileName}
                                setNewFileName={setNewFileName}
                                isCreatingNewFile={isCreatingNewFile}
                                setIsCreatingNewFile={setIsCreatingNewFile}
                                selectedFolder={selectedFolder}
                                setSelectedFolder={setSelectedFolder}
                                setTree={setSyncedTree}
                                setShare={setShare}
                                rootTree={visibleTree}
                                share={share}
                                onTreeRefresh={() => recoverTree(share.id)}
                            />
                        </OpenFoldersProvider>
                    )}
                </div>
            )}
        </div>
    )
}

const getProjectRoot = getWorkspaceRoot

function filterTree(tree: Tree, query: string): Tree {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
        return tree
    }

    return tree.flatMap((item): FileItem[] => {
        const ownMatch = item.name.toLowerCase().includes(normalizedQuery)
        if (item.type === 'folder') {
            const children = filterTree(item.children, query)
            if (ownMatch || children.length) {
                return [{ ...item, children }]
            }
            return []
        }

        return ownMatch ? [item] : []
    })
}

function TreeSkeleton() {
    return (
        <div aria-label='Loading file tree' className='space-y-3 p-2'>
            <div className='h-4 w-28 animate-pulse rounded bg-ui-border' />
            <div className='space-y-2'>
                {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className='flex items-center gap-2'>
                        <div className='h-4 w-4 animate-pulse rounded bg-ui-border' />
                        <div className={`h-3 animate-pulse rounded bg-ui-border ${index % 3 === 0 ? 'w-24' : index % 3 === 1 ? 'w-36' : 'w-28'}`} />
                    </div>
                ))}
            </div>
        </div>
    )
}
