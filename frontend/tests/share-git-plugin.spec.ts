import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('share editor exposes git import and pull from the right panel', async () => {
    const metadata = await readFile(path.join(root, 'src/components/share/metadata.tsx'), 'utf8')
    const plugin = await readFile(path.join(root, 'src/components/share/gitPlugin.tsx'), 'utf8')
    const github = await readFile(path.join(root, 'src/components/ai/github.ts'), 'utf8')

    expect(metadata).toContain('aria-label=\'Git plugin\'')
    expect(metadata).toContain('aria-label=\'Workspace status\'')
    expect(metadata).toContain('<GitPlugin shareRouteId={shareRouteId} share={share} />')
    expect(metadata).toContain('<WorkspaceStatus')

    expect(plugin).toContain('importGitHubRepository(currentInput, existingId, githubToken)')
    expect(plugin).toContain('persistGitHubRepository(persistedRepo)')
    expect(plugin).toContain('attachGitHubCredential(repo.id, githubToken.trim())')
    expect(plugin).toContain('syncRepositoryToShare({ repo: persistedRepo, token: accessToken, userId, onProgress: setSyncProgress })')
    expect(plugin).toContain('importRepositoryToShare({ repo: persistedRepo, token: accessToken, userId, onProgress: setSyncProgress })')
    expect(plugin).toContain('Log in to pull public repositories and private GitHub repositories')
    expect(plugin).toContain('owner/repo, GitHub URL, or public Git URL')
    expect(plugin).toContain('Auto pull')
    expect(plugin).toContain('Sync progress')
    expect(plugin).toContain('Language overview')
    expect(plugin).toContain('commitRepositoryWorkspace(shareRouteId')
    expect(plugin).toContain('pushRepositoryWorkspace(shareRouteId)')

    expect(github).toContain('export async function persistGitHubRepository')
    expect(github).toContain('aiClientRequest(\'/ai/repositories\'')
    expect(github).toContain('/git/status?shareId=')
    expect(github).toContain('/git/commit')
    expect(github).toContain('/git/push')
})

test('share editor exposes IDE explorer and workspace status controls', async () => {
    const explorer = await readFile(path.join(root, 'src/components/share/tree/explorer.tsx'), 'utf8')
    const treeHeader = await readFile(path.join(root, 'src/components/share/tree/treeHeader.tsx'), 'utf8')
    const workspaceStatus = await readFile(path.join(root, 'src/components/share/workspaceStatus.tsx'), 'utf8')

    expect(explorer).toContain('onRefresh={() => void recoverTree(share.id)}')
    expect(treeHeader).toContain('aria-label=\'Refresh file tree\'')
    expect(treeHeader).toContain('aria-label=\'Expand all folders\'')
    expect(treeHeader).toContain('aria-label=\'Collapse all folders\'')
    expect(workspaceStatus).toContain('Current file')
    expect(workspaceStatus).toContain('Open terminal')
    expect(workspaceStatus).toContain('hanasand.share.git.')
})
