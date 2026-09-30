'use client'

import { type ActorReference, actorReferenceMetadata } from '../pageClientShared'
import { useState } from 'react'

export default function ActorReferences({ citations, references, activeCitation }: { citations: string[]; references?: Array<{ name: string; url?: string }>; activeCitation: number | null }) {
    const [copiedCitation, setCopiedCitation] = useState<string | null>(null)
    const sourceByName = new Map((references ?? []).map(source => [source.name.trim().toLocaleLowerCase(), source]))
    const actorReferences: ActorReference[] = citations.map(name => {
        const key = name.toLocaleLowerCase()
        const source = sourceByName.get(key)
        const metadata = actorReferenceMetadata[key]
        const year = metadata?.year ?? name.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? 'n.d.'
        return { name, author: metadata?.author ?? 'Author unavailable', year, url: source?.url ?? metadata?.url }
    })
    const copyCitation = async (reference: ActorReference, format: 'apa' | 'latex', number: number) => {
        const value = format === 'apa'
            ? `${reference.author}. (${reference.year}). ${reference.name}. ${reference.url ?? ''}`.trim()
            : `@misc{ti-${number}, author = {${reference.author}}, title = {${reference.name}}, year = {${reference.year}}, url = {${reference.url ?? ''}}}`
        try {
            await navigator.clipboard.writeText(value)
            const copiedKey = `${number}-${format}`
            setCopiedCitation(copiedKey)
            window.setTimeout(() => setCopiedCitation(current => current === copiedKey ? null : current), 1000)
        } catch { setCopiedCitation(null) }
    }
    return <section className='border-t border-ui-border pt-4 dark:border-ui-border'>
        <h2 className='text-xs font-semibold uppercase tracking-wide text-ui-muted dark:text-ui-muted'>References ({actorReferences.length})</h2>
        <div className='mt-2 overflow-x-auto rounded-md border border-ui-border dark:border-ui-border'>
            <table className='min-w-full text-left text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                <thead className='border-b border-ui-border bg-ui-panel/60 text-[10px] uppercase tracking-wide text-ui-muted dark:border-ui-border dark:bg-ui-panel/60 dark:text-ui-muted'>
                    <tr><th className='px-3 py-2 font-semibold'>#</th><th className='px-3 py-2 font-semibold'>Title</th><th className='px-3 py-2 font-semibold'>Author</th><th className='px-3 py-2 font-semibold'>Year</th><th className='px-3 py-2 font-semibold'>Cite</th></tr>
                </thead>
                <tbody>
                    {actorReferences.map((reference, index) => {
                        const number = index + 1
                        return <tr key={reference.name} id={`ti-reference-${number}`} aria-current={activeCitation === number ? 'location' : undefined} className={`border-b border-ui-border last:border-b-0 transition-colors dark:border-ui-border ${activeCitation === number ? 'bg-ui-primary/15 text-ui-on-primary ring-1 ring-inset ring-ui-primary/45 dark:bg-ui-primary/15 dark:text-ui-on-primary' : ''}`}>
                            <td className='whitespace-nowrap px-3 py-2 align-top font-normal text-ui-muted dark:text-ui-muted'>{number}.</td>
                            <td className='min-w-72 px-3 py-2 align-top'>{reference.url ? <a href={reference.url} target='_blank' rel='noopener noreferrer' className='text-ui-text hover:text-ui-primary hover:underline dark:text-ui-text'>{reference.name}</a> : <span className='text-ui-text dark:text-ui-text'>{reference.name}</span>}</td>
                            <td className='min-w-48 px-3 py-2 align-top'>{reference.author}</td>
                            <td className='whitespace-nowrap px-3 py-2 align-top'>{reference.year}</td>
                            <td className='whitespace-nowrap px-3 py-2 align-top'><button type='button' onClick={event => { event.stopPropagation(); void copyCitation(reference, 'apa', number) }} className='mr-1 rounded border border-ui-border px-2 py-1 text-[10px] hover:border-ui-primary hover:text-ui-primary dark:border-ui-border' aria-label={`Copy APA citation for reference ${number}`}>{copiedCitation === `${number}-apa` ? 'Copied' : 'APA'}</button><button type='button' onClick={event => { event.stopPropagation(); void copyCitation(reference, 'latex', number) }} className='rounded border border-ui-border px-2 py-1 text-[10px] hover:border-ui-primary hover:text-ui-primary dark:border-ui-border' aria-label={`Copy LaTeX citation for reference ${number}`}>{copiedCitation === `${number}-latex` ? 'Copied' : 'LaTeX'}</button></td>
                        </tr>
                    })}
                </tbody>
            </table>
        </div>
    </section>
}
