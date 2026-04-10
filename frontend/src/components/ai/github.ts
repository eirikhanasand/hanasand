const MAX_FILES = 160
const MAX_FILE_SIZE = 250_000

type ParsedGitHubRepo = {
    owner: string
    repo: string
    branch?: string
    sourcePath: string
    sourceUrl: string
}

export async function importGitHubRepository(input: string, existingId?: string): Promise<AIImportedRepo> {
    const parsed = parseGitHubInput(input)
    const metadata = await getRepositoryMetadata(parsed.owner, parsed.repo)
    const branch = parsed.branch || metadata.default_branch
    const files: AIImportedRepoFile[] = []
    await loadDirectory(parsed.owner, parsed.repo, branch, parsed.sourcePath, files)

    return {
        id: existingId || crypto.randomUUID(),
        name: parsed.repo,
        fullName: `${parsed.owner}/${parsed.repo}`,
        branch,
        defaultBranch: metadata.default_branch,
        sourcePath: parsed.sourcePath,
        sourceUrl: buildSourceUrl(parsed.owner, parsed.repo, branch, parsed.sourcePath),
        files,
        truncated: files.length >= MAX_FILES,
        importedAt: new Date().toISOString(),
    }
}

function parseGitHubInput(input: string): ParsedGitHubRepo {
    const trimmed = input.trim()
    const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:\/tree\/([^/?#]+)(?:\/(.*))?)?/i)
    if (urlMatch) {
        return {
            owner: urlMatch[1],
            repo: urlMatch[2].replace(/\.git$/i, ''),
            branch: urlMatch[3] || undefined,
            sourcePath: (urlMatch[4] || '').replace(/^\/+|\/+$/g, ''),
            sourceUrl: trimmed,
        }
    }

    const shortMatch = trimmed.match(/^([^/\s]+)\/([^#\s]+)(?:#([^\s:]+))?(?::(.+))?$/)
    if (!shortMatch) {
        throw new Error('Use a GitHub URL or owner/repo format.')
    }

    return {
        owner: shortMatch[1],
        repo: shortMatch[2].replace(/\.git$/i, ''),
        branch: shortMatch[3] || undefined,
        sourcePath: (shortMatch[4] || '').replace(/^\/+|\/+$/g, ''),
        sourceUrl: trimmed,
    }
}

async function getRepositoryMetadata(owner: string, repo: string) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
    if (!response.ok) {
        throw new Error(`Failed to fetch repository metadata for ${owner}/${repo} (${response.status}).`)
    }
    return response.json() as Promise<{ default_branch: string }>
}

async function loadDirectory(owner: string, repo: string, branch: string, path: string, files: AIImportedRepoFile[]) {
    if (files.length >= MAX_FILES) {
        return
    }

    const endpoint = path
        ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
        : `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`
    const response = await fetch(endpoint)
    if (!response.ok) {
        throw new Error(`Failed to fetch ${owner}/${repo} (${response.status}).`)
    }

    const data = await response.json() as Array<{ type: 'file' | 'dir', path: string, name: string, size?: number, download_url?: string | null }>
    for (const item of data) {
        if (files.length >= MAX_FILES) {
            return
        }
        if (item.type === 'dir') {
            await loadDirectory(owner, repo, branch, item.path, files)
            continue
        }
        if (!item.download_url || (item.size || 0) > MAX_FILE_SIZE) {
            continue
        }

        const fileResponse = await fetch(item.download_url)
        if (!fileResponse.ok) {
            continue
        }

        files.push({ path: item.path, name: item.name, content: await fileResponse.text() })
    }
}

function buildSourceUrl(owner: string, repo: string, branch: string, sourcePath: string) {
    return sourcePath
        ? `https://github.com/${owner}/${repo}/tree/${branch}/${sourcePath}`
        : `https://github.com/${owner}/${repo}/tree/${branch}`
}
