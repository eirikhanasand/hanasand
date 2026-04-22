import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import config from '#constants'

type RepoPathArgs = {
    path?: string
}

type ListFilesArgs = RepoPathArgs & {
    limit?: number
}

type ReadRepoFileArgs = {
    path: string
    startLine?: number
    endLine?: number
}

type WriteRepoFileArgs = {
    path: string
    content: string
}

type GrepRepoArgs = {
    query: string
    path?: string
    limit?: number
}

const DEFAULT_LIST_LIMIT = 200
const DEFAULT_GREP_LIMIT = 60
const MAX_FILE_BYTES = 200_000
const IGNORED_DIRS = new Set([
    '.git',
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage',
])

function ensureInsideRepo(inputPath?: string) {
    const resolved = path.resolve(config.repo_root, inputPath || '.')
    if (resolved !== config.repo_root && !resolved.startsWith(`${config.repo_root}${path.sep}`)) {
        throw new Error('Path must stay inside the repository root.')
    }

    return resolved
}

export async function listRepoFiles(args: ListFilesArgs) {
    const root = ensureInsideRepo(args.path)
    const limit = Math.max(1, Math.min(args.limit ?? DEFAULT_LIST_LIMIT, 1000))
    const results: string[] = []

    async function walk(currentPath: string) {
        if (results.length >= limit) {
            return
        }

        const entries = await readdir(currentPath, { withFileTypes: true })
        entries.sort((left, right) => left.name.localeCompare(right.name))

        for (const entry of entries) {
            if (results.length >= limit) {
                return
            }

            if (entry.name.startsWith('.') && entry.name !== '.github' && entry.name !== '.vscode') {
                if (entry.name !== '.env.example') {
                    continue
                }
            }

            if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
                continue
            }

            const absolutePath = path.join(currentPath, entry.name)
            const relativePath = path.relative(config.repo_root, absolutePath) || '.'
            if (entry.isDirectory()) {
                await walk(absolutePath)
                continue
            }

            results.push(relativePath)
        }
    }

    const stats = await stat(root)
    if (stats.isFile()) {
        return {
            root: path.relative(config.repo_root, root) || '.',
            files: [path.relative(config.repo_root, root)],
            truncated: false,
        }
    }

    await walk(root)
    return {
        root: path.relative(config.repo_root, root) || '.',
        files: results,
        truncated: results.length >= limit,
    }
}

export async function readRepoFile(args: ReadRepoFileArgs) {
    const filePath = ensureInsideRepo(args.path)
    const fileStats = await stat(filePath)
    if (!fileStats.isFile()) {
        throw new Error('Path is not a file.')
    }
    if (fileStats.size > MAX_FILE_BYTES) {
        throw new Error(`File is too large to read safely (${fileStats.size} bytes).`)
    }

    const content = await readFile(filePath, 'utf8')
    const lines = content.split('\n')
    const startLine = Math.max(1, args.startLine ?? 1)
    const endLine = Math.max(startLine, Math.min(args.endLine ?? lines.length, lines.length))
    const selected = lines.slice(startLine - 1, endLine)

    return {
        path: path.relative(config.repo_root, filePath),
        startLine,
        endLine,
        content: selected.join('\n'),
        totalLines: lines.length,
    }
}

export async function writeRepoFile(args: WriteRepoFileArgs) {
    const filePath = ensureInsideRepo(args.path)
    const previousContent = await readFile(filePath, 'utf8').catch(() => '')
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, args.content, 'utf8')

    return {
        path: path.relative(config.repo_root, filePath),
        bytes: Buffer.byteLength(args.content, 'utf8'),
        lines: args.content.split('\n').length,
        previousContent,
        diff: buildUnifiedDiff(args.path, previousContent, args.content),
    }
}

export async function grepRepo(args: GrepRepoArgs) {
    const root = ensureInsideRepo(args.path)
    const limit = Math.max(1, Math.min(args.limit ?? DEFAULT_GREP_LIMIT, 200))
    const query = args.query.trim().toLowerCase()
    if (!query) {
        throw new Error('Search query cannot be empty.')
    }

    const files = await listRepoFiles({ path: path.relative(config.repo_root, root), limit: 1000 })
    const matches: Array<{ path: string, line: number, text: string }> = []

    for (const relativePath of files.files) {
        if (matches.length >= limit) {
            break
        }

        const absolutePath = ensureInsideRepo(relativePath)
        const fileStats = await stat(absolutePath).catch(() => null)
        if (!fileStats?.isFile() || fileStats.size > MAX_FILE_BYTES) {
            continue
        }

        const content = await readFile(absolutePath, 'utf8').catch(() => null)
        if (content === null) {
            continue
        }

        const lines = content.split('\n')
        for (let index = 0; index < lines.length; index += 1) {
            if (!lines[index].toLowerCase().includes(query)) {
                continue
            }

            matches.push({
                path: relativePath,
                line: index + 1,
                text: lines[index].slice(0, 240),
            })

            if (matches.length >= limit) {
                break
            }
        }
    }

    return {
        query: args.query,
        root: path.relative(config.repo_root, root) || '.',
        matches,
        truncated: matches.length >= limit,
    }
}

function buildUnifiedDiff(filePath: string, previousContent: string, nextContent: string) {
    if (previousContent === nextContent) {
        return `--- a/${filePath}\n+++ b/${filePath}\n@@\n<no changes>\n`
    }

    const previousLines = previousContent.split('\n')
    const nextLines = nextContent.split('\n')
    const maxLines = Math.max(previousLines.length, nextLines.length)
    const diffLines = [`--- a/${filePath}`, `+++ b/${filePath}`, '@@']

    for (let index = 0; index < maxLines; index += 1) {
        const before = previousLines[index]
        const after = nextLines[index]
        if (before === after) {
            if (typeof after === 'string') {
                diffLines.push(` ${after}`)
            }
            continue
        }

        if (typeof before === 'string') {
            diffLines.push(`-${before}`)
        }
        if (typeof after === 'string') {
            diffLines.push(`+${after}`)
        }
    }

    return diffLines.join('\n')
}
