'use client'

import { aiClientRequest } from '@/utils/ai/client'

export async function importGitHubRepository(input: string, existingId?: string) {
    const response = await aiClientRequest('/ai/import-repository', {
        method: 'POST',
        body: JSON.stringify({ input, existingId }),
    })

    const body = await response.json().catch(() => null)
    if (!response.ok) {
        throw new Error(body?.error || 'Failed to import repository.')
    }

    return body as AIImportedRepo
}
