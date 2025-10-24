'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { CircleCheckBig, Hourglass } from 'lucide-react'

type TestContentProps = {
    test: Test
    showLogs: boolean
    showErrors: boolean
}

export default function TestContent({ test, showLogs, showErrors }: TestContentProps) {
    const logs = test.logs.join('\n')
    const errors = test.errors.join('\n')
    const isDone = test.status === 'done'
    const isPending = test.status === 'pending'
    const metrics = test.summary || {}

    return (
        <div className="space-y-6 w-full">

            {/* Header / Overview */}
            <div className="flex justify-between items-center">
                <h1 className="text-lg font-semibold">Test Results</h1>
                <div className="text-sm text-gray-300">
                    {isDone 
                        ? <CircleCheckBig className='stroke-green-500 w-5 h-5' /> 
                        : isPending 
                            ? <Hourglass className='stroke-yellow-500 w-5 h-5' /> 
                            : <h1>Status: <span className="font-medium">{test.status}</span></h1>
                    }
                </div>
            </div>

            {/* Metrics Charts */}
            <div className="space-y-4">
                {metrics.rps && metrics.rps.length > 0 && (
                    <div>
                        <h2 className="font-medium text-white mb-2">Requests per Second</h2>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={metrics.rps}>
                                <XAxis dataKey="time" stroke="#aaa" />
                                <YAxis stroke="#aaa" />
                                <Tooltip />
                                <Line type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {metrics.latency && metrics.latency.length > 0 && (
                    <div>
                        <h2 className="font-medium text-white mb-2">Latency (ms)</h2>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={metrics.latency}>
                                <XAxis dataKey="time" stroke="#aaa" />
                                <YAxis stroke="#aaa" />
                                <Tooltip />
                                <Line type="monotone" dataKey="p50" stroke="#60a5fa" dot={false} />
                                <Line type="monotone" dataKey="p95" stroke="#facc15" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {metrics.errors && metrics.errors.length > 0 && (
                    <div>
                        <h2 className="font-medium text-white mb-2">Errors over time</h2>
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={metrics.errors}>
                                <XAxis dataKey="time" stroke="#aaa" />
                                <YAxis stroke="#aaa" />
                                <Tooltip />
                                <Bar dataKey="count" fill="#f87171" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Logs */}
            {showLogs && (
                <pre className="bg-dark rounded-md p-2 max-h-64 overflow-auto text-xs text-gray-200">
                    {logs}
                </pre>
            )}

            {/* Errors */}
            {showErrors && (
                <pre className="bg-dark rounded-md p-2 max-h-64 overflow-auto text-xs text-red-300">
                    {errors}
                </pre>
            )}
        </div>
    )
}
