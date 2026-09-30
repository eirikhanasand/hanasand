'use client'


export default function EvidenceBox({ href, children }: { href?: string; children: React.ReactNode }) {
    const className = `grid gap-1 border-b border-ui-border py-3 last:border-b-0 ${href ? 'rounded-lg px-2 transition hover:border-ui-primary/20 hover:bg-ui-primary/5 focus:outline-none focus:ring-1 focus:ring-ui-primary/35' : ''}`
    if (!href) return <div className={className}>{children}</div>
    return (
        <a href={href} target='_blank' rel='noopener noreferrer' className={className} title={href}>
            {children}
        </a>
    )
}
