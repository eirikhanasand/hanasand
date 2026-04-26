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

type EditRepoFileArgs = {
    path: string
    find: string
    replace: string
    replaceAll?: boolean
}

type BatchEditRepoFilesArgs = {
    edits: EditRepoFileArgs[]
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
const DENY_EDIT_SEGMENTS = ['.git/', 'node_modules/', '.next/', 'dist/', 'build/', 'coverage/']
const DENY_EDIT_EXTENSIONS = ['.pem', '.key', '.p12', '.crt', '.cer', '.der', '.sqlite', '.db', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.7z', '.gguf', '.dylib', '.so']
const PATCH_PREFERRED_BASENAMES = new Set([
    'package.json',
    'docker-compose.yml',
    'docker-compose.yaml',
    'dockerfile',
    'tsconfig.json',
    'eslint.config.mjs',
    'eslint.config.js',
    'next.config.ts',
    'next.config.js',
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
    assertRepoEditPolicy(args.path, 'write')
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

export async function editRepoFile(args: EditRepoFileArgs) {
    if (!args.find) {
        throw new Error('The find snippet cannot be empty.')
    }

    assertRepoEditPolicy(args.path, 'edit')
    const filePath = ensureInsideRepo(args.path)
    const fileStats = await stat(filePath)
    if (!fileStats.isFile()) {
        throw new Error('Path is not a file.')
    }
    if (fileStats.size > MAX_FILE_BYTES) {
        throw new Error(`File is too large to edit safely (${fileStats.size} bytes).`)
    }

    const previousContent = await readFile(filePath, 'utf8')
    const matchIndices = findAllMatchIndices(previousContent, args.find)
    const matchCount = matchIndices.length
    const matchedLines = matchIndices.map((index) => lineNumberFromIndex(previousContent, index))

    if (matchCount === 0) {
        throw new Error('The target snippet was not found in the file. Match count: 0.')
    }

    if (!args.replaceAll && matchCount > 1) {
        throw new Error(`The target snippet matched ${matchCount} times at lines ${matchedLines.join(', ')}. Refine the snippet or set replaceAll to true.`)
    }

    const nextContent = args.replaceAll
        ? previousContent.split(args.find).join(args.replace)
        : previousContent.replace(args.find, args.replace)

    await writeFile(filePath, nextContent, 'utf8')

    return {
        path: path.relative(config.repo_root, filePath),
        replacements: args.replaceAll ? matchCount : 1,
        matchCount,
        matchedLines,
        bytes: Buffer.byteLength(nextContent, 'utf8'),
        lines: nextContent.split('\n').length,
        previousContent,
        content: nextContent,
        previewBefore: buildPreviewExcerpt(previousContent, matchIndices[0], args.find.length),
        previewAfter: buildPreviewExcerpt(nextContent, matchIndices[0], args.replace.length),
        diff: buildUnifiedDiff(args.path, previousContent, nextContent),
    }
}

export async function batchEditRepoFiles(args: BatchEditRepoFilesArgs) {
    if (!Array.isArray(args.edits) || !args.edits.length) {
        throw new Error('The edits array cannot be empty.')
    }

    const originalContents = new Map<string, string>()
    const results: Array<Awaited<ReturnType<typeof editRepoFile>>> = []

    try {
        for (let index = 0; index < args.edits.length; index += 1) {
            const edit = args.edits[index]
            const filePath = ensureInsideRepo(edit.path)
            const relativePath = path.relative(config.repo_root, filePath)

            if (!originalContents.has(relativePath)) {
                const original = await readFile(filePath, 'utf8')
                originalContents.set(relativePath, original)
            }

            const result = await editRepoFile(edit)
            results.push(result)
        }

        return {
            ok: true,
            editsAttempted: args.edits.length,
            editsApplied: results.length,
            rolledBack: false,
            results,
        }
    } catch (error) {
        await Promise.all(
            [...originalContents.entries()].map(async ([relativePath, originalContent]) => {
                const filePath = ensureInsideRepo(relativePath)
                await writeFile(filePath, originalContent, 'utf8')
            })
        )

        return {
            ok: false,
            editsAttempted: args.edits.length,
            editsApplied: results.length,
            rolledBack: true,
            error: error instanceof Error ? error.message : String(error),
            results,
        }
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

function assertRepoEditPolicy(targetPath: string, operation: 'edit' | 'write') {
    const relativePath = path.relative(config.repo_root, ensureInsideRepo(targetPath)).replace(/\\/g, '/')
    const normalized = relativePath.toLowerCase()
    const baseName = path.basename(relativePath).toLowerCase()

    if (
        normalized === '.env'
        || (baseName.startsWith('.env.') && baseName !== '.env.example')
        || DENY_EDIT_SEGMENTS.some((segment) => normalized.includes(segment))
        || DENY_EDIT_EXTENSIONS.some((extension) => normalized.endsWith(extension))
    ) {
        throw new Error(`Denied by repo edit safety policy: ${relativePath} is a sensitive or non-text path.`)
    }

    if (operation === 'write') {
        if (
            PATCH_PREFERRED_BASENAMES.has(baseName)
            || normalized.startsWith('.github/workflows/')
            || normalized.includes('/.github/workflows/')
        ) {
            throw new Error(`Denied by repo edit safety policy: ${relativePath} is patch-safe but not rewrite-safe. Use edit_file instead of write_file.`)
        }
    }
}

function findAllMatchIndices(content: string, snippet: string) {
    const matches: number[] = []
    let fromIndex = 0

    while (fromIndex <= content.length) {
        const index = content.indexOf(snippet, fromIndex)
        if (index === -1) {
            break
        }

        matches.push(index)
        fromIndex = index + Math.max(snippet.length, 1)
    }

    return matches
}

function lineNumberFromIndex(content: string, index: number) {
    if (index <= 0) {
        return 1
    }

    return content.slice(0, index).split('\n').length
}

function buildPreviewExcerpt(content: string, index: number, length: number, radius = 80) {
    const start = Math.max(0, index - radius)
    const end = Math.min(content.length, index + length + radius)
    const prefix = start > 0 ? '...' : ''
    const suffix = end < content.length ? '...' : ''
    return `${prefix}${content.slice(start, end)}${suffix}`
}
