import { ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './markdown.css'
import Link from 'next/link'

type CustomLinkProps = {
    href: number
    children: ReactNode
}

const components = {
    // The md string should not contain a main header (#), the h1 header is  
    // rendered by the parent component. If by mistake it cointains 
    // a '# main header' this returns h2 instead.
    h1: ({children}: {children:ReactNode}) => <h2 className='markdown-render_h2'>{children}</h2>,
    h2: ({children}: {children:ReactNode}) => <h2 className='markdown-render_h2'>{children}</h2>,
    h3: ({children}: {children:ReactNode}) => <h3 className='markdown-render_h3'>{children}</h3>,
    h4: ({children}: {children:ReactNode}) => <h4 className='markdown-render_h4'>{children}</h4>,
    h5: ({children}: {children:ReactNode}) => <h5 className='markdown-render_h5'>{children}</h5>,
    h6: ({children}: {children:ReactNode}) => <h6 className='markdown-render_h6'>{children}</h6>,
    p:  ({children}: {children:ReactNode}) => <section className='markdown-render_section'>{children}</section>,
    em: ({children}: {children:ReactNode}) => <em className='markdown-render_em'>{children}</em>,
    strong: ({children}: {children:ReactNode}) => <strong className='markdown-render_strong'>{children}</strong>,
    table: ({children}: {children:ReactNode}) => <table className='markdown-render_table'>{children}</table>,
    th: ({children}: {children:ReactNode}) => <th className='markdown-render_th'>{children}</th>,
    td: ({children}: {children:ReactNode}) => <td className='markdown-render_td'>{children}</td>,
    ul: ({children}: {children:ReactNode}) => <ul className='markdown-render_ul'>{children}</ul>,
    ol: ({children}: {children:ReactNode}) => <ol className='markdown-render_ol'>{children}</ol>,
    li: ({children}: {children:ReactNode}) => <li className='markdown-render_li'>{children}</li>,
    a: CustomLink
}

export default function MarkdownRender({MDstr}: {MDstr: string}) {
    return (
        // @ts-expect-error
        <Markdown components={components} remarkPlugins={[remarkGfm]}>
            {MDstr.replace(/\\n/g, '\n')}
        </Markdown>
    )
}

function CustomLink({ href, children }: CustomLinkProps) {
    return (
        <Link
            className='link link--primary link--underscore-hover'
            href={String(href)}
            target='_blank'
            rel='noopener noreferrer'
        >
            {children}
        </Link>
    )
}
