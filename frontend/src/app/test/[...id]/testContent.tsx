'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import prettyDate from '@/utils/prettyDate'

type TestContentProps = {
    test: Test
}

export default function TestContent({ test }: TestContentProps) {
    const [logsVisible, setLogsVisible] = useState(false)
    const [errorsVisible, setErrorsVisible] = useState(false)

    const metrics = test.summary || {}
    console.log("test.summary", test.summary)

    return (
        <div className="p-4 space-y-6 w-full max-w-4xl mx-auto bg-white/5 rounded-xl shadow-md">

            {/* Header / Overview */}
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-semibold">Load Test: {test.url}</h1>
                <div className="text-sm text-gray-300">
                    Status: <span className="font-medium">{test.status}</span>
                </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                <div>Timeout: {test.timeout}s</div>
                <div>Created: {prettyDate(test.created_at)}</div>
                <div>Duration: {test.duration ? test.duration : '-'}</div>
                <div>Visits: {test.visits}</div>
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
            <div>
                <button
                    onClick={() => setLogsVisible((prev) => !prev)}
                    className="text-sm text-blue-400 underline"
                >
                    {logsVisible ? 'Hide Logs' : 'Show Logs'}
                </button>
                {logsVisible && (
                    <pre className="bg-black/20 rounded-md p-2 max-h-64 overflow-auto text-xs text-gray-200">
                        {test.logs.join('\n')}
                    </pre>
                )}
            </div>

            {/* Errors */}
            <div>
                <button
                    onClick={() => setErrorsVisible((prev) => !prev)}
                    className="text-sm text-red-400 underline"
                >
                    {errorsVisible ? 'Hide Errors' : 'Show Errors'}
                </button>
                {errorsVisible && (
                    <pre className="bg-black/20 rounded-md p-2 max-h-64 overflow-auto text-xs text-red-300">
                        {test.errors.join('\n')}
                    </pre>
                )}
            </div>
        </div>
    )
}
