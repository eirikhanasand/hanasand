type TreeCounts = {
    files: number
    folders: number
}

export function getWorkspaceRoot(tree: Tree | null, share: Share | null): FileFolder | null {
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

export function getVisibleWorkspaceTree(tree: Tree | null, share: Share | null): Tree | null {
    return getWorkspaceRoot(tree, share)?.children || tree
}

export function countTreeItems(tree: Tree | null): TreeCounts {
    return (tree || []).reduce((counts, file) => {
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

export function getWorkspaceName(tree: Tree | null, share: Share | null, fallbackId: string) {
    return getWorkspaceRoot(tree, share)?.name || share?.alias || fallbackId
}

export function findPath(tree: Tree | null, id: string, parents: string[] = []): string | null {
    for (const file of tree || []) {
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

export function isWorkspaceRootItem(tree: Tree | null, share: Share | null, id: string) {
    const root = getWorkspaceRoot(tree, share)
    return Boolean(root && root.id === id)
}

