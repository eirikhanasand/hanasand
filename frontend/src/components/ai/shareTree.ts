export function listTreePaths(tree: Tree | null, prefix = ''): string[] {
    if (!tree) {
        return []
    }

    return tree.flatMap((item) => {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        return item.type === 'folder' ? listTreePaths(item.children, path) : [path]
    })
}

export function findTreeFileId(tree: Tree | null, targetPath: string, prefix = ''): string | null {
    if (!tree) {
        return null
    }

    for (const item of tree) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.type === 'file' && path === targetPath) {
            return item.id
        }
        if (item.type === 'folder') {
            const nested = findTreeFileId(item.children, targetPath, path)
            if (nested) {
                return nested
            }
        }
    }

    return null
}
