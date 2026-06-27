'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { CircleCheckBig, Hourglass } from 'lucide-react'
import LogViewer from './logViewer'

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

    return (
        <div className='relative flex h-full min-w-0 flex-col gap-6 overflow-hidden pb-2'>

            {/* Header / Overview */}
            <div className='flex flex-wrap justify-between items-center gap-3'>
                <h1 className='text-lg font-semibold text-[#171a21] dark:text-[#f5f7fb]'>Test Results</h1>
                <div className='text-sm text-[#596170] dark:text-[#c7d0df]'>
                    {isDone
                        ? <CircleCheckBig className='stroke-green-500 w-5 h-5' />
                        : isPending
                            ? <Hourglass className='stroke-yellow-500 w-5 h-5' />
                            : <h1>Status: <span className='font-medium'>{test.status}</span></h1>
                    }
                </div>
            </div>

            {/* Metrics Charts */}
            <div className='min-w-0 space-y-4 overflow-y-auto overflow-x-hidden pr-1'>
                {(metrics.requests || duration.p95 || typeof metrics.failureRate === 'number') && (
                    <div className='grid gap-2 sm:grid-cols-3'>
                        <MetricCard label='Requests' value={metrics.requests ?? '0'} />
                        <MetricCard label='p95 latency' value={typeof duration.p95 === 'number' ? `${Math.round(duration.p95)}ms` : 'n/a'} />
                        <MetricCard label='Failures' value={typeof metrics.failureRate === 'number' ? `${(metrics.failureRate * 100).toFixed(1)}%` : 'n/a'} />
                    </div>
                )}
                {metrics.rps && metrics.rps.length > 0 && (
                    <div className='min-w-0'>
                        <h2 className='mb-2 font-medium text-[#171a21] dark:text-[#f5f7fb]'>Requests per Second</h2>
                        <ResponsiveContainer width='100%' height={200}>
                            <LineChart data={metrics.rps}>
                                <XAxis dataKey='time' stroke='#aaa' />
                                <YAxis stroke='#aaa' />
                                <Tooltip />
                                <Line type='monotone' dataKey='value' stroke='#4ade80' strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {metrics.latency && metrics.latency.length > 0 && (
                    <div className='min-w-0'>
                        <h2 className='mb-2 font-medium text-[#171a21] dark:text-[#f5f7fb]'>Latency (ms)</h2>
                        <ResponsiveContainer width='100%' height={200}>
                            <LineChart data={metrics.latency}>
                                <XAxis dataKey='time' stroke='#aaa' />
                                <YAxis stroke='#aaa' />
                                <Tooltip />
                                <Line type='monotone' dataKey='p50' stroke='#60a5fa' dot={false} />
                                <Line type='monotone' dataKey='p95' stroke='#facc15' dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {metrics.errors && metrics.errors.length > 0 && (
                    <div className='min-w-0'>
                        <h2 className='mb-2 font-medium text-[#171a21] dark:text-[#f5f7fb]'>Errors over time</h2>
                        <ResponsiveContainer width='100%' height={150}>
                            <BarChart data={metrics.errors}>
                                <XAxis dataKey='time' stroke='#aaa' />
                                <YAxis stroke='#aaa' />
                                <Tooltip />
                                <Bar dataKey='count' fill='#f87171' />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {showLogs && <LogViewer isDone={isDone} text={test.logs || []} />}
            {showErrors && <div className={`absolute bottom-0 left-0 ${isDone ? 'bg-red-50/95 backdrop-blur-md dark:bg-red-950/80' : 'bg-red-50 dark:bg-red-950/60'} max-h-[20rem] w-full overflow-auto rounded-lg border border-red-200 dark:border-red-400/30`}>
                <LogViewer text={test.errors || []} />
            </div>}
        </div>
    )
}

function MetricCard({ label, value }: { label: string, value: string | number }) {
    return (
        <div className='rounded-lg border border-[#dfe5ee] bg-[#f7f8fb] px-3 py-2 dark:border-[#30415f] dark:bg-[#0b1220]'>
            <div className='text-[11px] font-semibold uppercase text-[#596170] dark:text-[#9aa8bf]'>{label}</div>
            <div className='mt-1 text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{value}</div>
        </div>
    )
}
