export default function pathIsAllowedWhileUnauthorized(path: string) {
    if (path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/editor')) {
        return false
    }

    return true
}
