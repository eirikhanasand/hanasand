import Link from 'next/link'
import { ReactNode } from 'react'

type LinkOrDivProps = {
    children: ReactNode
    href?: string,
    className: string
}

export default function LinkorDiv({ children, href, className }: LinkOrDivProps) {
    if (href) {
        return (
            <Link href={href} className={className}>
                {children}
            </Link>
        )
    } else {
        return (
            <div className={className}>
                {children}
            </div>
        )
    }
}
