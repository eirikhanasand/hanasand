export function compactMarkdownLinkLabel(href: string | undefined, label: string): string {
    if (!href || !/^https?:\/\//i.test(href)) return label
    try {
        const destination = new URL(href)
        if (destination.href !== new URL(label).href) return label
        return `${destination.host}${destination.pathname === '/' ? '' : destination.pathname}${destination.search}${destination.hash}`
    } catch {
        return label
    }
}
