import { execFileSync } from 'node:child_process'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve, relative } from 'node:path'

const repoRoot = process.env.HANASAND_REPO_ROOT || resolve(process.cwd(), '..')
const articlesDirectory = join(repoRoot, 'articles')
const outputPath = resolve(process.cwd(), 'src/utils/articles/staticArticles.json')
const filenames = (await readdir(articlesDirectory)).filter((filename) => filename.endsWith('.md')).sort()
const previousArticles = await readPreviousArticles(outputPath)
const previousById = new Map(previousArticles.map((article) => [article.id, article]))

if (!filenames.length) throw new Error(`No article Markdown files found in ${articlesDirectory}`)

const articles = await Promise.all(filenames.map(async (filename) => {
    const filePath = join(articlesDirectory, filename)
    const source = await readFile(filePath, 'utf8')
    const { metadata, content } = parseMarkdown(source)
    const heading = content.match(/^#\s+(.*)$/m)?.[1]?.trim() || 'Untitled'
    const relativePath = relative(repoRoot, filePath)
    const created = gitDate(repoRoot, ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', relativePath])
    const modified = gitDate(repoRoot, ['log', '-1', '--format=%aI', '--', relativePath])
    const fallbackDate = (await stat(filePath)).mtime.toISOString()
    const previous = previousById.get(filename)
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length

    return {
        id: filename,
        title: heading,
        size: Buffer.byteLength(source),
        created: created || previous?.created || fallbackDate,
        modified: modified || previous?.modified || created || previous?.created || fallbackDate,
        content: content.trim(),
        metadata: {
            ...metadata,
            image: metadata.image || '',
            description: metadata.description || '',
            wordCount,
            estimatedMinutes: Math.ceil(wordCount / 80),
        },
    }
}))

await writeFile(outputPath, `${JSON.stringify(articles, null, 2)}\n`)
console.log(`Generated ${articles.length} static articles at ${outputPath}`)

function gitDate(cwd, args) {
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0] || ''
    } catch {
        return ''
    }
}

async function readPreviousArticles(path) {
    try {
        return JSON.parse(await readFile(path, 'utf8'))
    } catch {
        return []
    }
}

function parseMarkdown(source) {
    const frontmatter = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/)
    if (!frontmatter) return { metadata: {}, content: source }

    const metadata = {}
    for (const line of frontmatter[1].split(/\r?\n/)) {
        const match = line.match(/^([\w-]+):\s*(.*?)\s*$/)
        if (!match) continue
        let value = match[2]
        if (/^(['"]).*\1$/.test(value)) {
            value = value.slice(1, -1)
        }
        metadata[match[1]] = value
    }

    return { metadata, content: source.slice(frontmatter[0].length) }
}
