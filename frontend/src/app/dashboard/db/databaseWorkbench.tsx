'use client'

import { useMemo, useState, useTransition } from 'react'
import { Activity, Database, PlayCircle, Search } from 'lucide-react'
import { dashboardPanelClass } from '@/components/dashboard/ui'
import type { DatabaseOverview, DatabaseQueryResult } from '@/utils/db/internal'
import { databaseHealthAction, databaseRowsAction, databaseSqlAction } from './actions'

type TableOption = {
    schema: string
    name: string
    database: string
}

export default function DatabaseWorkbench({ overview }: { overview: DatabaseOverview }) {
    const tables = useMemo<TableOption[]>(() => overview.clusters.flatMap(cluster =>
        cluster.databases.flatMap(database => (database.tables || []).map(table => ({
            schema: table.schema,
            name: table.name,
            database: database.name,
        })))
    ), [overview.clusters])
    const firstTable = tables[0]
    const [schema, setSchema] = useState(firstTable?.schema || 'public')
    const [table, setTable] = useState(firstTable?.name || '')
    const [limit, setLimit] = useState(50)
    const [sql, setSql] = useState('select now() as checked_at;')
    const [message, setMessage] = useState('')
    const [result, setResult] = useState<DatabaseQueryResult | null>(null)
    const [isPending, startTransition] = useTransition()

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

    function checkLiveness() {
        startTransition(async () => {
            const response = await databaseHealthAction()
            if (typeof response === 'string') {
                setMessage(response.replace(/^Error:\s*/i, ''))
                return
            }
            setMessage(response.ok ? `Live: ${response.database || 'database'} checked ${formatDate(response.checked_at)}` : response.message || 'Liveness check failed.')
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
        <section className={`${dashboardPanelClass} p-4`} data-db-workbench>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>Database workbench</h2>
                    <p className='mt-1 text-sm text-ui-muted'>Inspect table rows, run a liveness check, or execute SQL as the system admin connection.</p>
                </div>
                <button
                    type='button'
                    onClick={checkLiveness}
                    disabled={isPending}
                    className='inline-flex min-h-10 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10 disabled:opacity-60'
                >
                    <Activity className='h-4 w-4' />
                    Check live
                </button>
            </div>

            <div className='mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]'>
                <div className='rounded-lg border border-ui-border bg-ui-canvas p-3'>
                    <div className='grid gap-3 sm:grid-cols-[1fr_0.7fr_0.45fr_auto] sm:items-end'>
                        <label className='grid gap-1.5 text-sm'>
                            <span className='text-xs font-semibold uppercase text-ui-muted'>Table</span>
                            <select
                                value={`${schema}.${table}`}
                                onChange={(event) => {
                                    const [nextSchema, nextTable] = event.target.value.split('.')
                                    setSchema(nextSchema || 'public')
                                    setTable(nextTable || '')
                                }}
                                className='min-h-10 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-primary'
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
                            className='inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:opacity-60'
                        >
                            <Search className='h-4 w-4' />
                            Inspect rows
                        </button>
                    </div>
                </div>

                <div className='rounded-lg border border-ui-border bg-ui-canvas p-3'>
                    <label className='grid gap-1.5 text-sm'>
                        <span className='text-xs font-semibold uppercase text-ui-muted'>SQL</span>
                        <textarea
                            value={sql}
                            onChange={event => setSql(event.target.value)}
                            rows={4}
                            className='min-h-28 rounded-md border border-ui-border bg-ui-panel px-3 py-2 font-mono text-xs text-ui-text outline-none focus:border-ui-primary'
                        />
                    </label>
                    <button
                        type='button'
                        onClick={runSql}
                        disabled={isPending || !sql.trim()}
                        className='mt-3 inline-flex min-h-10 items-center gap-2 rounded-md bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:opacity-60'
                    >
                        <PlayCircle className='h-4 w-4' />
                        {isPending ? 'Running...' : 'Execute SQL'}
                    </button>
                </div>
            </div>

            {message && <p className='mt-3 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text'>{message}</p>}
            {result ? <QueryResultTable result={result} /> : (
                <div className='mt-3 rounded-md border border-dashed border-ui-border bg-ui-canvas px-3 py-3 text-sm text-ui-muted'>
                    <p className='font-semibold text-ui-text'>Ready for inspection</p>
                    <p className='mt-1'>Choose a table or run SQL to see rows here.</p>
                </div>
            )}
        </section>
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

function formatDate(value?: string) {
    if (!value) return 'now'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
