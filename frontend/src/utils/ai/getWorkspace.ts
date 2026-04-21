import config from '@/config'

export async function getAiWorkspace({
    id,
    token,
}: {
    id?: string
    token?: string
}): Promise<{ conversations: AIConversation[], repositories: AIImportedRepo[] }> {
    if (!id || !token) {
        return { conversations: [], repositories: [] }
    }
    const normalizedToken = decodeURIComponent(token)

    const response = await fetch(`${config.url.api}/ai/workspace`, {
        headers: {
            Authorization: `Bearer ${normalizedToken}`,
            id,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        return { conversations: [], repositories: [] }
    }

    const data = await response.json().catch(() => null)
    return {
        conversations: Array.isArray(data?.conversations) ? data.conversations : [],
        repositories: Array.isArray(data?.repositories)
            ? data.repositories.map((repository: AIImportedRepo) => ({
                ...repository,
                syncStatus: repository.syncStatus || 'ready',
                lastSyncedAt: repository.lastSyncedAt || null,
                lastSyncError: repository.lastSyncError || null,
                syncHistory: Array.isArray(repository.syncHistory) ? repository.syncHistory : [],
            }))
            : [],
    }
}
