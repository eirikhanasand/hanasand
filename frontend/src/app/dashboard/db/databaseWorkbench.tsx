'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { Code2, PlayCircle, Search, Table2 } from 'lucide-react'
import { dashboardPanelClass } from '@/components/dashboard/ui'
import type { DatabaseOverview, DatabaseQueryResult } from '@/utils/db/internal'
import { databaseRowsAction, databaseSqlAction } from './actions'
import DatabaseConnection from './databaseConnection'

type TableOption = {
    schema: string
    name: string
    database: string
}

export default function DatabaseWorkbench({ overview, children }: { overview: DatabaseOverview, children?: ReactNode }) {
    const tables = useMemo<TableOption[]>(() => overview.clusters.flatMap(cluster =>
        cluster.databases.flatMap(database => (database.tables || []).map(table => ({
            schema: table.schema,
            name: table.name,
            database: database.name,
        })))
    ), [overview.clusters])
    const [open, setOpen] = useState(false)
    useEffect(() => {
        const toggle = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j' && !event.altKey) {
                event.preventDefault(); event.stopImmediatePropagation(); setOpen(value => !value)
            }
        }
        window.addEventListener('keydown', toggle, true)
        return () => window.removeEventListener('keydown', toggle, true)
    }, [])
    const firstTable = tables[0]
    const [schema, setSchema] = useState(firstTable?.schema || 'public')
    const [table, setTable] = useState(firstTable?.name || '')
    const [limit, setLimit] = useState(50)
    const [sql, setSql] = useState('select now() as checked_at;')
    const [message, setMessage] = useState('')
    const [result, setResult] = useState<DatabaseQueryResult | null>(null)
    const [isPending, startTransition] = useTransition()
    const [mode, setMode] = useState<'rows' | 'sql'>('rows')

    function inspectRows() {
        startTransition(async () => {
            const response = await databaseRowsAction(schema, table, limit)
            applyResponse(response)
        })
    }

    function runSql() {
        startTransition(async () => {
            const response = await databaseSqlAction(sql)
            applyResponse(response)
        })
    }

    function applyResponse(response: DatabaseQueryResult | string) {
        if (typeof response === 'string') {
            setResult(null)
            setMessage(response.replace(/^Error:\s*/i, ''))
            return
        }
        setResult(response)
        setMessage(`${response.rowCount} row${response.rowCount === 1 ? '' : 's'} returned.`)
    }

    return (
        <>
            <div className='flex flex-wrap items-center justify-end gap-3'>
                <h1 className='mr-auto text-xl font-semibold text-ui-text'>Databases</h1>
                <DatabaseConnection />
                <button type='button' aria-label='Search' title='Search (⌘ J)' disabled={overview.status === 'unavailable'} aria-expanded={open} aria-controls='database-workbench-content' onClick={() => setOpen(value => !value)} className='inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-ui-primary hover:bg-ui-primary/10 focus-visible:outline-ui-primary disabled:opacity-50'>
                    <Search aria-hidden className='h-4 w-4' /><kbd className='text-xs'>⌘ J</kbd>
                </button>
            </div>
            {children}
            {overview.status === 'unavailable' && <p role='alert' className='text-sm text-ui-warning'>{overview.health.message}</p>}
            <section id='database-workbench-content' hidden={!open || overview.status === 'unavailable'} className={`${dashboardPanelClass} min-w-0 overflow-hidden`} data-db-workbench aria-label='Search'>
                <div className='p-5'>
                    <h2 className='mb-4 text-base font-semibold'>Search</h2>
                    <div className='mb-4 flex gap-1 rounded-lg bg-ui-canvas p-1' aria-label='Search mode'>
                        {([{ id: 'rows', label: 'Browse tables', icon: Table2 }, { id: 'sql', label: 'SQL editor', icon: Code2 }] as const).map(tab => <button key={tab.id} type='button' aria-pressed={mode === tab.id} onClick={() => setMode(tab.id)} className={`inline-flex min-h-10 items-center gap-2 rounded-md px-4 text-sm font-medium ${mode === tab.id ? 'bg-ui-raised text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`}><tab.icon aria-hidden className='h-4 w-4' />{tab.label}</button>)}
                    </div>
                    {mode === 'rows' ? <div>
                        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6rem_auto] sm:items-end'>
                            <label className='grid gap-1.5 text-sm'>
                                <span className='text-xs font-semibold uppercase text-ui-muted'>Table</span>
                                <select
                                    value={`${schema}.${table}`}
                                    onChange={(event) => {
                                        const [nextSchema, nextTable] = event.target.value.split('.')
                                        setSchema(nextSchema || 'public')
                                        setTable(nextTable || '')
                                    }}
                                    className='h-11 w-full min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none focus:border-ui-primary'
                                >
                                    {!tables.length && <option value={`${schema}.${table}`}>No tables indexed</option>}
                                    {tables.map(option => (
                                        <option key={`${option.database}-${option.schema}-${option.name}`} value={`${option.schema}.${option.name}`}>
                                            {option.schema}.{option.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className='grid gap-1.5 text-sm'>
                                <span className='text-xs font-semibold uppercase text-ui-muted'>Schema</span>
                                <input value={schema} onChange={event => setSchema(event.target.value)} className='min-h-10 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-primary' />
                            </label>
                            <label className='grid gap-1.5 text-sm'>
                                <span className='text-xs font-semibold uppercase text-ui-muted'>Limit</span>
                                <input type='number' min={1} max={500} value={limit} onChange={event => setLimit(Number(event.target.value) || 50)} className='min-h-10 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-primary' />
                            </label>
                            <button
                                type='button'
                                onClick={inspectRows}
                                disabled={isPending || !table}
                                className='inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-ui-primary/40 bg-ui-primary/15 px-3 py-2 text-sm font-semibold text-ui-primary transition hover:opacity-90 disabled:opacity-60'
                            >
                                <Search className='h-4 w-4' />
                                Inspect rows
                            </button>
                        </div>
                    </div> : <div>
                        <label className='grid gap-1.5 text-sm'>
                            <span className='text-xs font-semibold uppercase text-ui-muted'>SQL</span>
                            <textarea
                                value={sql}
                                onChange={event => setSql(event.target.value)}
                                rows={7}
                                spellCheck={false}
                                className='min-h-48 w-full resize-y rounded-md border border-ui-border bg-ui-canvas p-4 font-mono text-sm leading-6 text-ui-text outline-none focus:border-ui-primary'
                            />
                        </label>
                        <button
                            type='button'
                            onClick={runSql}
                            disabled={isPending || !sql.trim()}
                            className='mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-ui-primary/40 bg-ui-primary/15 px-3 py-2 text-sm font-semibold text-ui-primary transition hover:opacity-90 disabled:opacity-60'
                        >
                            <PlayCircle className='h-4 w-4' />
                            {isPending ? 'Running...' : 'Execute SQL'}
                        </button>
                    </div>}

                    {message && <p role='status' className='mt-4 text-sm text-ui-text'>{message}</p>}
                    {result ? <QueryResultTable result={result} /> : (
                        <div className='mt-5 border-t border-ui-border py-6 text-center text-sm text-ui-muted'>
                            {mode === 'rows' ? 'Choose a table to view its rows.' : 'Run a query to see results.'}
                        </div>
                    )}
                </div>
            </section>
        </>
    )
}

function QueryResultTable({ result }: { result: DatabaseQueryResult }) {
    const fields = result.fields.length ? result.fields : Object.keys(result.rows[0] || {})
    return (
        <div className='mt-3 overflow-x-auto rounded-lg border border-ui-border'>
            <table className='min-w-full text-left text-xs'>
                <thead className='border-b border-ui-border bg-ui-panel uppercase text-ui-muted'>
                    <tr>{fields.map(field => <th key={field} className='px-3 py-2 font-semibold'>{field}</th>)}</tr>
                </thead>
                <tbody className='divide-y divide-ui-border bg-ui-canvas text-ui-text'>
                    {result.rows.map((row, index) => (
                        <tr key={index}>
                            {fields.map(field => <td key={field} className='max-w-80 px-3 py-2 align-top'><code className='wrap-break-word'>{formatCell(row[field])}</code></td>)}
                        </tr>
                    ))}
                    {!result.rows.length && (
                        <tr><td className='px-3 py-3 text-ui-muted' colSpan={Math.max(fields.length, 1)}>Statement completed without returned rows.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

function formatCell(value: unknown) {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}
