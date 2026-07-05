import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DatabaseDashboard } from '../src/app/dashboard/db/databaseDashboard.tsx'
import type { DatabaseOverview } from '../src/utils/db/internal'

const healthyOverview: DatabaseOverview = {
    status: 'healthy',
    generatedAt: '2026-07-02T10:00:00.000Z',
    clusterCount: 1,
    databaseCount: 2,
    totalSizeBytes: 113246208,
    activeQueries: 1,
    averageQuerySeconds: 12,
    longRunningThresholdSeconds: 60,
    health: { message: 'Database metrics loaded from the live PostgreSQL telemetry views.' },
    longestQuery: {
        database: 'hanasand',
        user: 'app',
        state: 'active',
        durationSeconds: 12,
        waitEventType: null,
        waitEvent: null,
        query: 'select 1',
        isLongRunning: false,
    },
    queries: [{
        database: 'hanasand',
        user: 'app',
        state: 'active',
        durationSeconds: 12,
        waitEventType: null,
        waitEvent: null,
        query: 'select 1',
        isLongRunning: false,
    }],
    clusters: [{
        id: 'primary-postgres',
        name: 'hanasand cluster',
        engine: 'PostgreSQL',
        version: '16.4',
        host: '10.0.0.5:5432',
        activeQueries: 1,
        totalSizeBytes: 113246208,
        databaseCount: 2,
        databases: [
            { name: 'hanasand', sizeBytes: 104857600, tableCount: 42, activeConnections: 4 },
            { name: 'postgres', sizeBytes: 8388608, tableCount: null, activeConnections: 1 },
        ],
    }],
}

const healthyMarkup = renderToStaticMarkup(React.createElement(DatabaseDashboard, { overview: healthyOverview }))
assert.match(healthyMarkup, /Active and long-running queries/)
assert.match(healthyMarkup, /No long-running queries right now/)
assert.match(healthyMarkup, /data-db-monitor-metrics/)
assert.match(healthyMarkup, /hanasand/)
assert.match(healthyMarkup, /42/)
assert.match(healthyMarkup, /Backups/)
assert.match(healthyMarkup, /Restore/)
assert.doesNotMatch(healthyMarkup, /Clusters<\/span><\/div><p[^>]*>0</)

const unavailableMarkup = renderToStaticMarkup(React.createElement(DatabaseDashboard, {
    overview: {
        status: 'unavailable',
        generatedAt: '2026-07-02T10:00:00.000Z',
        clusterCount: null,
        databaseCount: null,
        totalSizeBytes: null,
        activeQueries: null,
        averageQuerySeconds: null,
        longRunningThresholdSeconds: 60,
        longestQuery: null,
        queries: [],
        clusters: [],
        health: {
            category: 'auth',
            message: 'Database metrics unavailable: the internal API cannot authenticate to PostgreSQL.',
            detail: 'Check DB_USER and DB_PASSWORD for the API service, then retry the dashboard.',
        },
    } satisfies DatabaseOverview,
}))

assert.match(unavailableMarkup, /Database metrics unavailable/)
assert.match(unavailableMarkup, /Unavailable/)
assert.match(unavailableMarkup, /Query telemetry unavailable/)
assert.doesNotMatch(unavailableMarkup, /password authentication failed/i)

console.log('Database dashboard render checks passed.')
