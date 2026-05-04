import { getCookie } from '@/utils/cookies/cookies'
import { getShare } from '@/utils/share/get'

export type WorkspaceFile = {
    id: string
    name: string
    path: string
}

export type IndexedWorkspaceFile = WorkspaceFile & {
    content: string
}

export type WorkspaceSearchOptions = {
    caseSensitive: boolean
    wholeWord: boolean
    regex: boolean
    include: string
    exclude: string
}

export type WorkspaceMatch = {
    id: string
    file: WorkspaceFile
    line: number
    column: number
    endColumn: number
    preview: string
    functionName: string | null
}

export type WorkspaceFileMatches = {
    file: WorkspaceFile
    matches: WorkspaceMatch[]
}

const searchableExtensions = new Set([
    'c',
    'cc',
    'cpp',
    'cs',
    'css',
    'go',
    'html',
    'java',
    'js',
    'json',
    'jsx',
    'kt',
    'md',
    'mjs',
    'py',
    'rb',
    'rs',
    'scss',
    'sh',
    'sql',
    'swift',
    'toml',
    'ts',
    'tsx',
    'txt',
    'xml',
    'yaml',
    'yml',
])

export function flattenWorkspaceTree(tree: Tree | null): WorkspaceFile[] {
    const files: WorkspaceFile[] = []

    function walk(items: Tree, parentPath: string) {
        for (const item of items) {
            const path = parentPath ? `${parentPath}/${item.name}` : item.name
            if (item.type === 'folder') {
                walk(item.children, path)
                continue
            }

            files.push({
                id: item.id,
                name: item.name,
                path,
            })
        }
    }

    if (tree) {
        walk(tree, '')
    }

    return stripSingleRoot(files)
}

function stripSingleRoot(files: WorkspaceFile[]) {
    if (!files.length) {
        return files
    }

    const [root] = files[0].path.split('/')
    if (!root || files.some(file => !file.path.startsWith(`${root}/`))) {
        return files
    }

    return files.map(file => ({
        ...file,
        path: file.path.slice(root.length + 1) || file.name,
    }))
}

export function isLikelySearchableFile(path: string) {
    const extension = path.split('.').pop()?.toLowerCase()
    if (!extension) {
        return true
    }

    return searchableExtensions.has(extension)
}

export async function loadWorkspaceFiles({
    files,
    activeShare,
    activeContent,
    cache,
}: {
    files: WorkspaceFile[]
    activeShare: Share | null
    activeContent: string
    cache: Map<string, IndexedWorkspaceFile>
}) {
    const userId = getCookie('id') ?? undefined
    const token = getCookie('access_token') ?? undefined
    const activeId = activeShare?.id

    const indexed = await Promise.all(files
        .filter(file => isLikelySearchableFile(file.path))
        .map(async (file): Promise<IndexedWorkspaceFile | null> => {
            if (file.id === activeId) {
                const current = { ...file, content: activeContent }
                cache.set(file.id, current)
                return current
            }

            const cached = cache.get(file.id)
            if (cached) {
                return cached
            }

            const share = await getShare({ id: file.id, token, userId })
            if (typeof share === 'string') {
                return null
            }

            const loaded = { ...file, content: share.content || '' }
            cache.set(file.id, loaded)
            return loaded
        }))

    return indexed.filter(Boolean) as IndexedWorkspaceFile[]
}

export function createSearchExpression(query: string, options: WorkspaceSearchOptions) {
    const source = options.regex ? query : escapeRegExp(query)
    const boundedSource = options.wholeWord ? `\\b${source}\\b` : source
    return new RegExp(boundedSource, options.caseSensitive ? 'g' : 'gi')
}

export function searchIndexedFiles(
    files: IndexedWorkspaceFile[],
    query: string,
    options: WorkspaceSearchOptions,
) {
    const cleanQuery = query.trim()
    if (!cleanQuery) {
        return []
    }

    const expression = createSearchExpression(cleanQuery, options)
    const filtered = files.filter(file => matchesPathFilters(file.path, options.include, options.exclude))
    const groups: WorkspaceFileMatches[] = []

    for (const file of filtered) {
        const lines = file.content.split(/\r?\n/)
        const matches: WorkspaceMatch[] = []

        lines.forEach((lineText, lineIndex) => {
            expression.lastIndex = 0
            let match = expression.exec(lineText)
            while (match) {
                const value = match[0]
                const column = match.index + 1
                matches.push({
                    id: `${file.id}:${lineIndex + 1}:${column}:${matches.length}`,
                    file,
                    line: lineIndex + 1,
                    column,
                    endColumn: column + Math.max(value.length - 1, 0),
                    preview: lineText.trim() || lineText,
                    functionName: findEnclosingSymbol(lines, lineIndex),
                })

                if (value.length === 0) {
                    expression.lastIndex += 1
                }
                match = expression.exec(lineText)
            }
        })

        if (matches.length) {
            groups.push({ file, matches })
        }
    }

    return groups
}

export function replaceInContent(content: string, query: string, replacement: string, options: WorkspaceSearchOptions) {
    const expression = createSearchExpression(query, options)
    return content.replace(expression, replacement)
}

export function countMatches(groups: WorkspaceFileMatches[]) {
    return groups.reduce((count, group) => count + group.matches.length, 0)
}

export function extractClickedToken(word: string | null) {
    return word?.match(/[A-Za-z_$][\w$-]*/)?.[0] || ''
}

export function findSymbolDefinitions(files: IndexedWorkspaceFile[], symbol: string) {
    if (!symbol.trim()) {
        return []
    }

    const escaped = escapeRegExp(symbol.trim())
    const definitionExpression = new RegExp(
        `\\b(function\\s+${escaped}|class\\s+${escaped}|interface\\s+${escaped}|type\\s+${escaped}|const\\s+${escaped}|let\\s+${escaped}|var\\s+${escaped}|${escaped}\\s*[:=]\\s*(async\\s*)?(function|\\(|[A-Za-z_$]))\\b`
    )

    return files.flatMap(file => {
        const lines = file.content.split(/\r?\n/)
        return lines.flatMap((lineText, index) => definitionExpression.test(lineText)
            ? [{
                id: `${file.id}:definition:${index + 1}`,
                file,
                line: index + 1,
                column: Math.max(lineText.indexOf(symbol), 0) + 1,
                endColumn: Math.max(lineText.indexOf(symbol), 0) + symbol.length,
                preview: lineText.trim(),
                functionName: findEnclosingSymbol(lines, index),
            }]
            : []
        )
    })
}

export function findEnclosingSymbol(lines: string[], lineIndex: number) {
    for (let index = lineIndex; index >= 0; index -= 1) {
        const line = lines[index]
        const match = line.match(/\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)
            || line.match(/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function\b)/)
            || line.match(/\b(?:export\s+)?(?:class|interface|type)\s+([A-Za-z_$][\w$]*)/)

        if (match?.[1]) {
            return match[1]
        }
    }

    return null
}

function matchesPathFilters(path: string, include: string, exclude: string) {
    const includeFilters = splitFilters(include)
    const excludeFilters = splitFilters(exclude)
    const included = includeFilters.length === 0 || includeFilters.some(filter => globLikeMatch(path, filter))
    const excluded = excludeFilters.some(filter => globLikeMatch(path, filter))
    return included && !excluded
}

function splitFilters(value: string) {
    return value
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
}

function globLikeMatch(path: string, filter: string) {
    if (!filter.includes('*')) {
        return path.toLowerCase().includes(filter.toLowerCase())
    }

    const escaped = filter.split('*').map(escapeRegExp).join('.*')
    return new RegExp(`^${escaped}$`, 'i').test(path)
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
