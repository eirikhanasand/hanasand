export function getCookie(name: string): string | null {
    const matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\/\\+^])/g, '\\$1') + "=([^;]*)"
    ))
    return matches ? decodeURIComponent(matches[1]) : null
}

export function setCookie(name: string, value: string, days?: number) {
    let expires = ""

    if (days) {
        const date = new Date()
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
        expires = `expires=${date.toUTCString()};`
    }

    // Ensure the cookie is set with a proper expiration, path, and SameSite
    document.cookie = `${name}=${encodeURIComponent(value)}; ${expires} path=/; SameSite=Lax`
}
