export default function isSharePath(path: string | null | undefined) {
    if (!path) {
        return false
    }

    try {
        const parsed = new URL(path)
        return parsed.pathname === '/s' || parsed.pathname.startsWith('/s/')
    } catch {
        return path === '/s' || path.endsWith('/s') || path.startsWith('/s/')
    }
}
