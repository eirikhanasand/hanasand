import randomId from '@/utils/random/randomId'
import postShare from '@/utils/share/post'

type ImportRepositoryToShareProps = {
    repo: AIImportedRepo
    token?: string | null
    userId?: string | null
}

export async function importRepositoryToShare({
    repo,
    token,
    userId,
}: ImportRepositoryToShareProps) {
    if (!token || !userId) {
        throw new Error('You must be signed in to sync a repository into the editor.')
    }

    const root = await postShare({
        id: repo.id,
        includeTree: true,
        content: '',
        name: repo.name,
        path: repo.fullName,
        type: 'folder',
        token,
        userId,
    })
    if (!root) {
        throw new Error('Failed to create the repository workspace.')
    }

    const folderIds = new Map<string, string>([['', repo.id]])
    for (const file of repo.files) {
        const segments = file.path.split('/').filter(Boolean)
        const directories = segments.slice(0, -1)
        let parentId = repo.id
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

        const name = segments.at(-1)
        if (!name) {
            continue
        }

        const fileResponse = await postShare({
            id: randomId(),
            includeTree: false,
            content: file.content,
            name,
            parent: parentId,
            type: 'file',
            token,
            userId,
        })
        if (!fileResponse) {
            throw new Error(`Failed to create file ${file.path}.`)
        }
    }

    return repo.id
}
