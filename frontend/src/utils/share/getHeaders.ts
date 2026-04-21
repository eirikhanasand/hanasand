export default function getShareHeaders(token?: string | null, userId?: string | null) {
    const headers: Record<string, string> = {}

    if (token) {
        headers.Authorization = `Bearer ${token}`
    }

    if (userId) {
        headers.id = userId
    }

    return headers
}
