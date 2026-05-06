'use client'

import { Dispatch, SetStateAction, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FileCode2, FolderTree, GitBranch, MonitorUp, TerminalSquare } from 'lucide-react'

type WorkspaceStatusProps = {
    shareRouteId: string
    share: Share | null
    tree: Tree | null
    terminalStatus: string
    setTriggerTerminalChange: Dispatch<SetStateAction<boolean | 'close'>>
}

type StoredGitWorkspace = {
    input: string
    fullName: string
    branch: string
    sourcePath: string
    updatedAt: string
    lastSyncedAt?: string
}

type TreeCounts = {
    files: number
    folders: number
}

const storagePrefix = 'hanasand.share.git.'

export default function WorkspaceStatus({
    shareRouteId,
    share,
    tree,
    terminalStatus,
    setTriggerTerminalChange,
}: WorkspaceStatusProps) {
    const [storedGit, setStoredGit] = useState<StoredGitWorkspace | null>(null)
    const counts = useMemo(() => countTreeItems(tree || []), [tree])
    const activePath = useMemo(() => findPath(tree || [], share?.id || shareRouteId), [share?.id, shareRouteId, tree])

    useEffect(() => {
        function refreshStoredGit() {
            setStoredGit(readStoredGitWorkspace(share?.id || shareRouteId) || readStoredGitWorkspace(shareRouteId))
        }

        refreshStoredGit()
        window.addEventListener('storage', refreshStoredGit)

        return () => window.removeEventListener('storage', refreshStoredGit)
    }, [share?.id, shareRouteId])

    const workspaceName = getWorkspaceName(tree, share) || share?.alias || shareRouteId

    return (
        <section className='space-y-2 rounded-lg border border-bright/8 bg-black/16 p-3 text-bright/72'>
            <StatusRow
                icon={<FolderTree className='h-4 w-4' />}
                label='Workspace'
                value={workspaceName}
                detail={`${counts.files} files · ${counts.folders} folders`}
            />
            <StatusRow
                icon={<FileCode2 className='h-4 w-4' />}
                label='Current file'
                value={activePath || share?.alias || 'No file open'}
                detail={share ? `${share.wordCount} words` : 'Waiting for workspace'}
            />
            <StatusRow
                icon={<GitBranch className='h-4 w-4' />}
                label='Git'
                value={storedGit ? storedGit.fullName : 'No repository loaded'}
                detail={storedGit ? `${storedGit.branch}${storedGit.sourcePath ? ` / ${storedGit.sourcePath}` : ''}` : 'Use the Git panel to load or inspect changes'}
            />
            <div className='rounded-lg border border-bright/8 bg-bright/[0.025] p-2.5'>
                <div className='flex items-start gap-2'>
                    <TerminalSquare className='mt-0.5 h-4 w-4 shrink-0 text-bright/55' />
                    <div className='min-w-0 flex-1'>
                        <div className='text-[10px] font-semibold uppercase tracking-[0.18em] text-bright/38'>Terminal</div>
                        <div className='mt-1 text-sm font-semibold text-bright/82'>{terminalStatus || 'Terminal status unknown'}</div>
                    </div>
                </div>
                <button
                    type='button'
                    aria-label='Open terminal panel'
                    onClick={() => setTriggerTerminalChange(true)}
                    className='mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-bright/8 px-2 text-[11px] font-semibold text-bright/78 transition hover:bg-bright/12 hover:text-bright'
                >
                    <MonitorUp className='h-3.5 w-3.5' />
                    Open terminal
                </button>
            </div>
        </section>
    )
}

function StatusRow({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return (
        <div className='flex items-start gap-2 rounded-lg border border-bright/8 bg-bright/[0.025] p-2.5'>
            <span className='mt-0.5 shrink-0 text-bright/55'>{icon}</span>
            <div className='min-w-0'>
                <div className='text-[10px] font-semibold uppercase tracking-[0.18em] text-bright/38'>{label}</div>
                <div className='mt-1 truncate text-sm font-semibold text-bright/82'>{value}</div>
                <div className='mt-0.5 truncate text-[11px] leading-4 text-bright/45'>{detail}</div>
            </div>
        </div>
    )
}

function readStoredGitWorkspace(shareId: string) {
    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(`${storagePrefix}${shareId}`)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<StoredGitWorkspace>
        if (!parsed.input || !parsed.fullName || !parsed.branch) return null
        return {
            input: parsed.input,
            fullName: parsed.fullName,
            branch: parsed.branch,
            sourcePath: parsed.sourcePath || '',
            updatedAt: parsed.updatedAt || '',
            lastSyncedAt: parsed.lastSyncedAt || parsed.updatedAt || '',
        }
    } catch {
        return null
    }
}

function countTreeItems(tree: Tree): TreeCounts {
    return tree.reduce((counts, file) => {
        if (file.type === 'folder') {
            const childCounts = countTreeItems(file.children)
            return {
                files: counts.files + childCounts.files,
                folders: counts.folders + childCounts.folders + 1,
            }
        }

        return {
            files: counts.files + 1,
            folders: counts.folders,
        }
    }, { files: 0, folders: 0 })
}

function findPath(tree: Tree, id: string, parents: string[] = []): string | null {
    for (const file of tree) {
        const path = [...parents, file.name]
        if (file.id === id) {
            return path.join('/')
        }

        if (file.type === 'folder') {
            const childPath = findPath(file.children, id, path)
            if (childPath) {
                return childPath
            }
        }
    }

    return null
}

function getWorkspaceName(tree: Tree | null, share: Share | null) {
    if (!tree || tree.length !== 1) {
        return null
    }

    const [root] = tree
    if (root.type === 'folder' && (root.id === share?.id || root.parent === null)) {
        return root.name
    }

    return null
}
