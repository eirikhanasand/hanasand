import randomId from '@/utils/random/randomId'
import { getTree } from '@/utils/share/getTree'
import postShare from '@/utils/share/post'
import { updateShare } from '@/utils/share/put'
import { deleteShare } from '@/utils/share/delete'
import { findTreeFileId } from '@/components/ai/shareTree'

type SyncRepositoryToShareProps = {
    repo: AIImportedRepo
    token?: string | null
    userId?: string | null
    onProgress?: (progress: AISyncProgress) => void
}

export async function syncRepositoryToShare({
    repo,
    token,
    userId,
    onProgress,
}: SyncRepositoryToShareProps) {
    if (!token || !userId) {
        throw new Error('You must be signed in to sync a repository into the editor.')
    }

    const tree = await getTree({ id: repo.id, token, userId })
    if (!tree) {
        return importRepositoryToShareFallback({ repo, token, userId, onProgress })
    }

    const folderIds = new Map<string, string>([['', repo.id]])
    registerFolders(tree, '', folderIds)

    let syncedFiles = 0
    onProgress?.({ syncedFiles, totalFiles: repo.files.length, currentPath: null })
    for (const file of repo.files) {
        const parentId = await ensureParentFolder({
            folderIds,
            filePath: file.path,
            rootId: repo.id,
            token,
            userId,
        })
        const fileId = findTreeFileId(tree, file.path)
        if (fileId) {
            await updateShare(fileId, { content: file.content })
            syncedFiles += 1
            onProgress?.({ syncedFiles, totalFiles: repo.files.length, currentPath: file.path })
            continue
        }

        const name = file.path.split('/').pop()
        if (!name) {
            continue
        }

        const created = await postShare({
            id: randomId(),
            includeTree: false,
            content: file.content,
            name,
            parent: parentId,
            type: 'file',
            token,
            userId,
        })
        if (!created) {
            throw new Error(`Failed to create file ${file.path}.`)
        }
        syncedFiles += 1
        onProgress?.({ syncedFiles, totalFiles: repo.files.length, currentPath: file.path })
    }

    await pruneRemovedEntries({
        tree,
        nextFiles: new Set(repo.files.map((file) => file.path)),
        token,
        userId,
    })
    await updateShare(repo.id, { path: repo.fullName })
    return repo.id
}

async function ensureParentFolder({
    folderIds,
    filePath,
    rootId,
    token,
    userId,
}: {
    folderIds: Map<string, string>
    filePath: string
    rootId: string
    token: string
    userId: string
}) {
    const directories = filePath.split('/').filter(Boolean).slice(0, -1)
    let parentId = rootId
    let currentPath = ''

    for (const directory of directories) {
        currentPath = currentPath ? `${currentPath}/${directory}` : directory
        const existingFolderId = folderIds.get(currentPath)
        if (existingFolderId) {
            parentId = existingFolderId
            continue
        }

        const folderId = randomId()
        const response = await postShare({
            id: folderId,
            includeTree: false,
            content: '',
            name: directory,
            parent: parentId,
            type: 'folder',
            token,
            userId,
        })
        if (!response) {
            throw new Error(`Failed to create folder ${currentPath}.`)
        }

        folderIds.set(currentPath, folderId)
        parentId = folderId
    }

    return parentId
}

function registerFolders(tree: Tree, prefix: string, folderIds: Map<string, string>) {
    for (const item of tree) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.type === 'folder') {
            folderIds.set(path, item.id)
            registerFolders(item.children, path, folderIds)
        }
    }
}

async function pruneRemovedEntries({
    tree,
    nextFiles,
    token,
    userId,
}: {
    tree: Tree
    nextFiles: Set<string>
    token: string
    userId: string
}) {
    const staleFiles: string[] = []
    const staleFolders: { id: string, depth: number }[] = []
    collectStaleEntries(tree, '', nextFiles, staleFiles, staleFolders)

    for (const fileId of staleFiles) {
        const ok = await deleteShare(fileId, token, userId)
        if (!ok) {
            throw new Error('Failed to remove a stale file from the repository workspace.')
        }
    }

    for (const folder of staleFolders.sort((left, right) => right.depth - left.depth)) {
        const ok = await deleteShare(folder.id, token, userId)
        if (!ok) {
            throw new Error('Failed to remove a stale folder from the repository workspace.')
        }
    }
}

function collectStaleEntries(
    tree: Tree,
    prefix: string,
    nextFiles: Set<string>,
    staleFiles: string[],
    staleFolders: { id: string, depth: number }[],
) {
    for (const item of tree) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.type === 'file') {
            if (!nextFiles.has(path)) {
                staleFiles.push(item.id)
            }
            continue
        }

        collectStaleEntries(item.children, path, nextFiles, staleFiles, staleFolders)
        const keepFolder = [...nextFiles].some((filePath) => filePath.startsWith(`${path}/`))
        if (!keepFolder) {
            staleFolders.push({ id: item.id, depth: path.split('/').length })
        }
    }
}

async function importRepositoryToShareFallback({
    repo,
    token,
    userId,
    onProgress,
}: {
    repo: AIImportedRepo
    token: string
    userId: string
    onProgress?: (progress: AISyncProgress) => void
}) {
    const { importRepositoryToShare } = await import('./importRepositoryToShare')
    return importRepositoryToShare({ repo, token, userId, onProgress })
}
