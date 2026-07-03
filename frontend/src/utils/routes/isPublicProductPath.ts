export default function isPublicProductPath(path: string | null | undefined) {
    if (!path) {
        return false
    }

    let pathname: string

    try {
        pathname = new URL(path).pathname
    } catch {
        pathname = path.split('?')[0]?.split('#')[0] || path
    }

    return pathname === '/'
        || pathname === '/pricing'
        || pathname === '/solutions'
        || pathname.startsWith('/solutions/')
        || pathname === '/contact'
        || pathname === '/developers'
        || pathname === '/about'
        || pathname === '/ti'
        || pathname.startsWith('/ti/')
        || pathname === '/pwned'
        || pathname === '/status'
        || pathname === '/trust'
        || pathname.startsWith('/trust/')
        || pathname === '/support'
        || pathname === '/gallery'
        || pathname === '/upload'
        || pathname === '/login'
        || pathname === '/register'
        || pathname === '/reset-password'
        || pathname === '/account-pending-deletion'
        || pathname === '/reserved-usernames'
        || pathname === '/terms'
        || pathname === '/privacy'
        || pathname === '/cookies'
        || pathname === '/cookie-settings'
        || pathname === '/g'
        || pathname.startsWith('/g/')
        || pathname === '/article'
        || pathname.startsWith('/article/')
        || pathname === '/articles'
        || pathname.startsWith('/articles/')
        || pathname === '/s'
        || pathname.startsWith('/s/')
        || pathname === '/test'
        || pathname.startsWith('/test/')
        || pathname === '/eirik'
        || pathname.startsWith('/eirik/')
}
