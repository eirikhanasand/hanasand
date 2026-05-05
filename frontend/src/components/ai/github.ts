'use client'

import { aiClientRequest } from '@/utils/ai/client'

export async function importGitHubRepository(input: string, existingId?: string, githubToken?: string) {
    const response = await aiClientRequest('/ai/import-repository', {
        method: 'POST',
        body: JSON.stringify({ input, existingId, githubToken: githubToken?.trim() || undefined }),
    })

    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(body?.error || 'Failed to import repository.')
    }

    return {
        ...body,
        authMode: body?.authMode || 'public',
        authHint: body?.authHint || null,
        credential: body?.credential && typeof body.credential === 'object'
            ? body.credential
            : {
                provider: 'github_pat',
                hasCredential: false,
                tokenHint: null,
                attachedAt: null,
                lastUsedAt: null,
                lastValidatedAt: null,
            },
        syncStatus: body?.syncStatus || 'syncing',
        lastSyncedAt: body?.lastSyncedAt || null,
        lastSyncError: body?.lastSyncError || null,
        syncHistory: Array.isArray(body?.syncHistory) ? body.syncHistory : [],
    } as AIImportedRepo
}

export async function attachGitHubCredential(repositoryId: string, githubToken: string) {
    const response = await aiClientRequest(`/ai/repositories/${encodeURIComponent(repositoryId)}/credentials/github`, {
        method: 'PUT',
        body: JSON.stringify({ githubToken }),
    })

    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(body?.error || 'Failed to save GitHub credential.')
    }

    return body?.credential as AIRepositoryCredentialSummary
}

export async function persistGitHubRepository(repo: AIImportedRepo) {
    const response = await aiClientRequest('/ai/repositories', {
        method: 'POST',
        body: JSON.stringify(repo),
    })

    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(body?.error || 'Failed to save repository sync state.')
    }
}

export async function removeGitHubCredential(repositoryId: string) {
    const response = await aiClientRequest(`/ai/repositories/${encodeURIComponent(repositoryId)}/credentials/github`, {
        method: 'DELETE',
    })

    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(body?.error || 'Failed to remove GitHub credential.')
    }
}

export async function getRepositoryGitStatus(repositoryId: string, shareId: string) {
    const response = await aiClientRequest(`/ai/repositories/${encodeURIComponent(repositoryId)}/git/status?shareId=${encodeURIComponent(shareId)}`)
    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(body?.error || 'Failed to load Git status.')
    }

    return body as AIGitStatus
}

export async function pullRepositoryWorkspace(repositoryId: string) {
    const response = await aiClientRequest(`/ai/repositories/${encodeURIComponent(repositoryId)}/git/pull`, {
        method: 'POST',
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(body?.error || 'Failed to pull repository.')
    }

    return body as AIGitStatus
}

export async function commitRepositoryWorkspace(repositoryId: string, shareId: string, message: string, paths: string[]) {
    const response = await aiClientRequest(`/ai/repositories/${encodeURIComponent(repositoryId)}/git/commit`, {
        method: 'POST',
        body: JSON.stringify({ shareId, message, paths }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(body?.error || 'Failed to commit staged files.')
    }

    return body as { ok: true, commit: string, status: AIGitStatus }
}

export async function pushRepositoryWorkspace(repositoryId: string) {
    const response = await aiClientRequest(`/ai/repositories/${encodeURIComponent(repositoryId)}/git/push`, {
        method: 'POST',
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(body?.error || 'Failed to push repository.')
    }

    return body as AIGitStatus
}
