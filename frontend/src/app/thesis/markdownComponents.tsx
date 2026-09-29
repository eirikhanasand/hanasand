import type { ReactNode } from 'react'
import type { Components } from 'react-markdown'
import { compactMarkdownLinkLabel } from './markdownLink'

function textOnly(children: ReactNode): string | null {
    if (typeof children === 'string') return children
    if (Array.isArray(children) && children.every(child => typeof child === 'string')) return children.join('')
    return null
}

export const thesisMarkdownComponents: Components = {
    a({ href, children, node, ...props }) {
        void node
        const label = textOnly(children)
        return <a {...props} href={href}>{label === null ? children : compactMarkdownLinkLabel(href, label)}</a>
    },
}
