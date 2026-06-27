'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts'
import { Activity, CircleCheckBig, FileText, Hourglass, ServerCrash } from 'lucide-react'
import LogViewer from './logViewer'
import type { CSSProperties, ReactNode } from 'react'

type TestContentProps = {
    test: Test
    showLogs: boolean
    showErrors: boolean
}

export default function TestContent({ test, showLogs, showErrors }: TestContentProps) {
    const isDone = test.status === 'done'
    const isPending = test.status === 'pending'
    const metrics = (test.summary || {}) as {
        requests?: number
        failureRate?: number
        duration?: { p95?: number }
        rps?: Array<{ time: string | number, value: number }>
        latency?: Array<{ time: string | number, p50?: number, p95?: number }>
        errors?: Array<{ time: string | number, count: number }>
    }
    const duration = metrics.duration || {}
    const hasMetrics = Boolean(metrics.requests || duration.p95 || typeof metrics.failureRate === 'number')
    const hasCharts = Boolean(metrics.rps?.length || metrics.latency?.length || metrics.errors?.length)
    const logs = test.logs || []
    const errors = test.errors || []
    const statusTone = isDone
        ? 'border-[#bde8ca] bg-[#e9f8ef] text-[#11612f] dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-200'
        : isPending
            ? 'border-[#f8df9b] bg-[#fff8e1] text-[#8a5a00] dark:border-yellow-400/30 dark:bg-yellow-400/12 dark:text-yellow-100'
            : 'border-[#c7d7fe] bg-[#eef3ff] text-[#3056d3] dark:border-blue-400/30 dark:bg-blue-400/12 dark:text-blue-100'
    const StatusIcon = isDone ? CircleCheckBig : isPending ? Hourglass : Activity

    return (
        <div className='relative grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden pb-1'>
            <div className='flex flex-wrap items-start justify-between gap-3 border-b border-[#e3e8f0] pb-3 dark:border-[#273752]'>
                <div className='min-w-0'>
                    <h1 className='text-lg font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Test results</h1>
                    <p className='mt-1 max-w-2xl text-xs leading-5 text-[#596170] dark:text-[#b8c2d4]'>
                        Metrics, charts, logs, and evidence from the selected run.
                    </p>
                </div>
                <div className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${statusTone}`}>
                    <StatusIcon className='h-4 w-4' />
                    <span>{isDone ? 'Complete' : isPending ? 'Pending' : test.status}</span>
                </div>
            </div>

            <div className='min-w-0 overflow-y-auto overflow-x-hidden pr-1'>
                <div className='grid min-w-0 gap-4'>
                    {hasMetrics ? (
                        <div className='grid gap-2 sm:grid-cols-3'>
                            <MetricCard label='Requests' value={metrics.requests ?? '0'} emphasis />
                            <MetricCard label='p95 latency' value={typeof duration.p95 === 'number' ? `${Math.round(duration.p95)}ms` : 'n/a'} />
                            <MetricCard
                                label='Failure rate'
                                value={typeof metrics.failureRate === 'number' ? `${(metrics.failureRate * 100).toFixed(1)}%` : 'n/a'}
                                tone={typeof metrics.failureRate === 'number' && metrics.failureRate > 0 ? 'danger' : 'success'}
                            />
                        </div>
                    ) : (
                        <EmptyState
                            icon={<Activity className='h-5 w-5' />}
                            title={isDone ? 'No aggregate metrics reported' : 'Metrics will appear as the run progresses'}
                            body={isDone ? 'The run finished without a summary payload. Logs and errors below may still contain useful evidence.' : 'Keep this page open for live updates from the runner.'}
                        />
                    )}

                    {hasCharts ? (
                        <div className='grid min-w-0 gap-3 xl:grid-cols-2'>
                            {metrics.rps && metrics.rps.length > 0 && (
                                <ChartPanel title='Requests per second'>
                                    <ResponsiveContainer width='100%' height={220}>
                                        <LineChart data={metrics.rps} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
                                            <CartesianGrid stroke='#e3e8f0' strokeDasharray='3 3' />
                                            <XAxis dataKey='time' stroke='#667085' tick={{ fontSize: 11 }} />
                                            <YAxis stroke='#667085' tick={{ fontSize: 11 }} />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Line type='monotone' dataKey='value' stroke='#147a3b' strokeWidth={2.5} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </ChartPanel>
                            )}

                            {metrics.latency && metrics.latency.length > 0 && (
                                <ChartPanel title='Latency'>
                                    <ResponsiveContainer width='100%' height={220}>
                                        <LineChart data={metrics.latency} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
                                            <CartesianGrid stroke='#e3e8f0' strokeDasharray='3 3' />
                                            <XAxis dataKey='time' stroke='#667085' tick={{ fontSize: 11 }} />
                                            <YAxis stroke='#667085' tick={{ fontSize: 11 }} />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Line type='monotone' dataKey='p50' stroke='#3056d3' strokeWidth={2} dot={false} />
                                            <Line type='monotone' dataKey='p95' stroke='#8a5a00' strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </ChartPanel>
                            )}

                            {metrics.errors && metrics.errors.length > 0 && (
                                <ChartPanel title='Errors over time'>
                                    <ResponsiveContainer width='100%' height={180}>
                                        <BarChart data={metrics.errors} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
                                            <CartesianGrid stroke='#e3e8f0' strokeDasharray='3 3' />
                                            <XAxis dataKey='time' stroke='#667085' tick={{ fontSize: 11 }} />
                                            <YAxis stroke='#667085' tick={{ fontSize: 11 }} />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Bar dataKey='count' fill='#b42318' radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartPanel>
                            )}
                        </div>
                    ) : (
                        <EmptyState
                            icon={<FileText className='h-5 w-5' />}
                            title='No chart data yet'
                            body={isDone ? 'This run did not include time-series samples.' : 'Charts will populate once the runner sends request, latency, or error samples.'}
                        />
                    )}

                    <div className='grid min-h-64 min-w-0 gap-3 lg:grid-cols-2'>
                        {showLogs && (
                            <LogPanel title={`Logs (${logs.length})`} empty='No log lines have been received yet.' hasContent={logs.length > 0}>
                                <LogViewer isDone={isDone} text={logs} />
                            </LogPanel>
                        )}
                        {showErrors && (
                            <LogPanel title={`Errors (${errors.length})`} empty='No errors have been reported.' hasContent={errors.length > 0} danger>
                                <LogViewer text={errors} />
                            </LogPanel>
                        )}
                        {!showLogs && !showErrors && (
                            <EmptyState
                                icon={<ServerCrash className='h-5 w-5' />}
                                title='Logs and errors are hidden'
                                body='Use the controls in the details panel to show run evidence.'
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const tooltipStyle: CSSProperties = {
    borderRadius: 8,
    border: '1px solid #dfe5ee',
    color: '#171a21',
    fontSize: 12
}

function MetricCard({ label, value, tone = 'default', emphasis = false }: { label: string, value: string | number, tone?: 'default' | 'success' | 'danger', emphasis?: boolean }) {
    const toneClass = tone === 'success'
        ? 'border-[#bde8ca] bg-[#e9f8ef] text-[#11612f] dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-100'
        : tone === 'danger'
            ? 'border-[#fecdca] bg-[#fff1f0] text-[#912018] dark:border-red-400/30 dark:bg-red-400/12 dark:text-red-100'
            : 'border-[#dfe5ee] bg-[#f7f8fb] text-[#171a21] dark:border-[#30415f] dark:bg-[#0b1220] dark:text-[#f5f7fb]'

    return (
        <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
            <div className='text-[11px] font-semibold uppercase text-[#596170] dark:text-[#b8c2d4]'>{label}</div>
            <div className={`mt-1 font-semibold ${emphasis ? 'text-2xl' : 'text-xl'}`}>{value}</div>
        </div>
    )
}

function ChartPanel({ title, children }: { title: string, children: ReactNode }) {
    return (
        <section className='min-w-0 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-3 dark:border-[#30415f] dark:bg-[#0b1220]'>
            <h2 className='mb-2 text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{title}</h2>
            {children}
        </section>
    )
}

function LogPanel({ title, empty, children, hasContent, danger = false }: { title: string, empty: string, children: ReactNode, hasContent: boolean, danger?: boolean }) {
    return (
        <section className={`grid min-h-64 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 rounded-lg border p-3 ${danger ? 'border-red-200 bg-red-50 dark:border-red-400/30 dark:bg-red-950/30' : 'border-[#dfe5ee] bg-[#fbfcfe] dark:border-[#30415f] dark:bg-[#0b1220]'}`}>
            <h2 className={`text-sm font-semibold ${danger ? 'text-[#912018] dark:text-red-100' : 'text-[#171a21] dark:text-[#f5f7fb]'}`}>{title}</h2>
            <div className='min-h-0 min-w-0'>
                {hasContent ? children : <div className='grid h-full place-items-center rounded-md border border-dashed border-[#cfd7e4] bg-white/60 p-4 text-center text-sm text-[#667085] dark:border-[#30415f] dark:bg-[#08111f]'>{empty}</div>}
            </div>
        </section>
    )
}

function EmptyState({ icon, title, body }: { icon: ReactNode, title: string, body: string }) {
    return (
        <div className='grid min-h-32 place-items-center rounded-lg border border-dashed border-[#cfd7e4] bg-[#f8fafc] p-4 text-center dark:border-[#30415f] dark:bg-[#0b1220]'>
            <div>
                <div className='mx-auto grid h-10 w-10 place-items-center rounded-lg border border-[#dfe5ee] bg-white text-[#3056d3] dark:border-[#30415f] dark:bg-[#101827] dark:text-blue-200'>
                    {icon}
                </div>
                <h2 className='mt-3 text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{title}</h2>
                <p className='mt-1 max-w-md text-sm leading-6 text-[#596170] dark:text-[#b8c2d4]'>{body}</p>
            </div>
        </div>
    )
}
