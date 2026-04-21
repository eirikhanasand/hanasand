import config from '@/config'

export async function deleteShare(id: string, token?: string | null, userId?: string | null) {
    if (!id || !token || !userId) {
        return false
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.abortTimeout)

    try {
        const response = await fetch(`${config.url.cdn}/share/${id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                id: userId,
            },
            signal: controller.signal,
        })

        clearTimeout(timeout)
        return response.ok
    } catch (error) {
        console.error(`Error deleting share: ${error}`)
        return false
    }
}
