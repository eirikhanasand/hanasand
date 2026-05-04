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
