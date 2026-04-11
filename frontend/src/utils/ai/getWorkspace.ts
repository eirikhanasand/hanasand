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

    return response.json()
}
