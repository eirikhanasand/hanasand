function parseGitHubInput(input: string) {
    const trimmed = input.trim()
    const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:\/tree\/([^/?#]+))?/i)
    if (urlMatch) {
        return {
            owner: urlMatch[1],
            repo: urlMatch[2].replace(/\.git$/i, ''),
            branch: urlMatch[3] || 'main',
            sourceUrl: trimmed,
        }
    }

    const shortMatch = trimmed.match(/^([^/\s]+)\/([^#\s]+)(?:#([^\s]+))?$/)
    if (!shortMatch) {
        throw new Error('Use a GitHub URL or owner/repo format.')
    }

    return {
        owner: shortMatch[1],
        repo: shortMatch[2].replace(/\.git$/i, ''),
        branch: shortMatch[3] || 'main',
        sourceUrl: `https://github.com/${shortMatch[1]}/${shortMatch[2].replace(/\.git$/i, '')}`,
    }
}

export async function importGitHubRepository(input: string): Promise<AIImportedRepo> {
    const parsed = parseGitHubInput(input)
    const files: AIImportedRepoFile[] = []

    await loadDirectory(parsed.owner, parsed.repo, parsed.branch, '', files)

    return {
        id: crypto.randomUUID(),
        name: parsed.repo,
        fullName: `${parsed.owner}/${parsed.repo}`,
        branch: parsed.branch,
        sourceUrl: parsed.sourceUrl,
        files,
        importedAt: new Date().toISOString(),
    }
}

async function loadDirectory(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    files: AIImportedRepoFile[],
) {
    if (files.length >= 120) {
        return
    }

    const endpoint = path
        ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
        : `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`
    const response = await fetch(endpoint)

    if (!response.ok) {
        throw new Error(`Failed to fetch ${owner}/${repo} (${response.status}).`)
    }

    const data = await response.json() as Array<{
        type: 'file' | 'dir'
        path: string
        name: string
        size?: number
        download_url?: string | null
    }>

    for (const item of data) {
        if (files.length >= 120) {
            return
        }

        if (item.type === 'dir') {
            await loadDirectory(owner, repo, branch, item.path, files)
            continue
        }

        if (!item.download_url || (item.size || 0) > 250_000) {
            continue
        }

        const fileResponse = await fetch(item.download_url)
        if (!fileResponse.ok) {
            continue
        }

        files.push({
            path: item.path,
            name: item.name,
            content: await fileResponse.text(),
        })
    }
}
