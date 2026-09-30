'use client'

import { displayRequirementText } from '../pageModel'
import { MouseEvent } from 'react'
import MarkdownRender from '@/components/markdown/markdown'

export default function ActorDescription({ description, citations, onCitationClick }: { description: string; citations: string[]; activeCitation: number | null; onCitationClick: (number: number) => void }) {
    const citationPattern = new RegExp('\\(Citation:\\s*([^)]+)\\)', 'g')
    const renderedDescription = description.replace(citationPattern, (_match, rawName: string) => {
        const citationNumber = citations.indexOf(rawName.trim()) + 1
        return citationNumber > 0 ? `[${citationNumber}](#ti-reference-${citationNumber})` : _match
    })
    if (!citations.length) return <div className='mt-3 max-w-3xl text-sm leading-6 text-ui-muted dark:text-ui-muted'><MarkdownRender MDstr={displayRequirementText(description)} /></div>
    const handleCitationClick = (event: MouseEvent<HTMLDivElement>) => {
        const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#ti-reference-"]')
        if (!link) return
        const match = link.hash.match(/^#ti-reference-(\d+)$/)
        if (!match) return
        event.preventDefault()
        const number = Number(match[1])
        onCitationClick(number)
        document.getElementById(match[0].slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    return <div onClick={handleCitationClick} className='mt-3 max-w-3xl text-sm leading-6 text-ui-muted dark:text-ui-muted'>
        <MarkdownRender MDstr={displayRequirementText(renderedDescription)} />
    </div>
}
