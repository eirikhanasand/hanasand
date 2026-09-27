'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type ArticleRow = Article & {
    metadata?: Article['metadata'] & {
        author?: string
        category?: string
        pageVisits?: number
        publishedAt?: string
    }
}

export default function DashboardArticles({ articles }: { articles: ArticleRow[] }) {
    const [title, setTitle] = useState('')
    const [author, setAuthor] = useState('all')
    const [publishDate, setPublishDate] = useState('')
    const [minimumVisits, setMinimumVisits] = useState('')
    const [category, setCategory] = useState('all')

    const authors = useMemo(() => unique(articles.map(article => article.metadata?.author)), [articles])
    const categories = useMemo(() => unique(articles.map(article => article.metadata?.category || 'Uncategorized')), [articles])
    const filteredArticles = articles.filter(article => {
        const articleAuthor = article.metadata?.author?.trim() || ''
        const articleCategory = article.metadata?.category?.trim() || 'Uncategorized'
        const date = article.metadata?.publishedAt || article.created
        const visits = article.metadata?.pageVisits

        return article.title.toLowerCase().includes(title.trim().toLowerCase())
            && (author === 'all' || articleAuthor === author)
            && (!publishDate || date.slice(0, 10) === publishDate)
            && (!minimumVisits || (typeof visits === 'number' && visits >= Number(minimumVisits)))
            && (category === 'all' || articleCategory === category)
    })

    return (
        <div className='overflow-x-auto'>
            <table className='w-full min-w-[900px] border-collapse text-left text-sm'>
                <thead className='bg-ui-raised/50 text-xs font-semibold uppercase tracking-wide text-ui-muted'>
                    <tr>
                        <th scope='col' className='px-4 py-3'>Title</th>
                        <th scope='col' className='px-4 py-3'>Author</th>
                        <th scope='col' className='px-4 py-3'>Publish date</th>
                        <th scope='col' className='px-4 py-3 text-right'>Page visits</th>
                        <th scope='col' className='px-4 py-3'>Category</th>
                    </tr>
                    <tr className='border-t border-ui-border bg-ui-panel normal-case tracking-normal'>
                        <th className='px-3 py-2'><input aria-label='Filter by title' value={title} onChange={event => setTitle(event.target.value)} placeholder='Filter titles' className={filterClass} /></th>
                        <th className='px-3 py-2'><select aria-label='Filter by author' value={author} onChange={event => setAuthor(event.target.value)} className={filterClass}><option value='all'>All authors</option>{authors.map(value => <option key={value} value={value}>{value}</option>)}</select></th>
                        <th className='px-3 py-2'><input aria-label='Filter by publish date' type='date' value={publishDate} onChange={event => setPublishDate(event.target.value)} className={filterClass} /></th>
                        <th className='px-3 py-2'><input aria-label='Filter by minimum page visits' type='number' min='0' value={minimumVisits} onChange={event => setMinimumVisits(event.target.value)} placeholder='Min visits' className={`${filterClass} text-right`} /></th>
                        <th className='px-3 py-2'><select aria-label='Filter by category' value={category} onChange={event => setCategory(event.target.value)} className={filterClass}><option value='all'>All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></th>
                    </tr>
                </thead>
                <tbody className='divide-y divide-ui-border'>
                    {filteredArticles.map(article => {
                        const date = article.metadata?.publishedAt || article.created
                        const visits = article.metadata?.pageVisits
                        return <tr key={article.id} className='transition hover:bg-ui-raised/40'>
                            <td className='max-w-[28rem] px-4 py-3 font-medium text-ui-text'><Link href={`/articles/${article.id}`} className='block truncate hover:text-ui-primary'>{article.title || article.id}</Link></td>
                            <td className='px-4 py-3 text-ui-muted'>{article.metadata?.author || '—'}</td>
                            <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatDate(date)}</td>
                            <td className='px-4 py-3 text-right tabular-nums text-ui-muted'>{typeof visits === 'number' ? visits.toLocaleString('en-US') : '—'}</td>
                            <td className='px-4 py-3 text-ui-muted'>{article.metadata?.category || 'Uncategorized'}</td>
                        </tr>
                    })}
                    {!filteredArticles.length && <tr><td colSpan={5} className='px-4 py-10 text-center text-sm text-ui-muted'>No articles match these filters.</td></tr>}
                </tbody>
            </table>
        </div>
    )
}

const filterClass = 'min-h-9 w-full min-w-28 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-normal text-ui-text placeholder:text-ui-muted focus-visible:outline-2 focus-visible:outline-ui-primary'

function unique(values: Array<string | undefined>) {
    return [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b))
}

function formatDate(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
}
