import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import type { DatabaseOverview } from '../src/utils/db/internal'

mock.module('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
const { DatabaseDashboard } = await import('../src/app/dashboard/db/databaseDashboard.tsx')

const frontendApi = await readFile(new URL('../src/utils/db/internal.ts', import.meta.url), 'utf8')
const apiRoutes = await readFile(new URL('../../api/src/routes.ts', import.meta.url), 'utf8')

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
            { name: 'hanasand', sizeBytes: 104857600, tableCount: 42, activeConnections: 4, tables: [{ schema: 'public', name: 'users', estimatedRows: 12 }] },
            { name: 'postgres', sizeBytes: 8388608, tableCount: null, activeConnections: 1 },
        ],
    }],
}

const healthyMarkup = renderToStaticMarkup(React.createElement(DatabaseDashboard, { overview: healthyOverview }))
assert.match(healthyMarkup, /<details id="active-queries"/)
assert.match(healthyMarkup, />Queries</)
assert.match(healthyMarkup, /Longest running query/)
assert.equal((healthyMarkup.match(/data-query-card/g) || []).length, 2)
assert.equal((healthyMarkup.match(/<details/g) || []).length, 2, 'Only the two section dropdowns remain')
assert.match(healthyMarkup, /1 shown · 0 long-running · Long-running after 1m · Checked 10:00 UTC<\/span><\/summary>/)
for (const summary of healthyMarkup.matchAll(/<summary[^>]*>(.*?)<\/summary>/g)) assert.doesNotMatch(summary[1], /<code/)
assert.match(healthyMarkup, /hljs-keyword/)
assert.match(healthyMarkup, /aria-label="SQL query"/)
assert.doesNotMatch(healthyMarkup, /<th[^>]*>Duration/)

const { QueryCode } = await import('../src/app/dashboard/db/queryCard.tsx')
const codeMarkup = renderToStaticMarkup(React.createElement(QueryCode, { query: 'SELECT last_id, recent_id FROM cursors WHERE name = \'<script>alert(1)</script>\'' }))
assert.match(codeMarkup, /\n/)
assert.match(codeMarkup, /hljs-string/)
assert.doesNotMatch(codeMarkup, /<script>/)
assert.match(codeMarkup, /&lt;script&gt;/)
const incompleteMarkup = renderToStaticMarkup(React.createElement(QueryCode, { query: 'SELECT \'unfinished' }))
assert.match(incompleteMarkup, /unfinished/)
assert.match(healthyMarkup, /data-db-monitor-metrics/)
assert.match(healthyMarkup, /hanasand/)
assert.match(healthyMarkup, /Backups/)
assert.match(healthyMarkup, /Restore/)
assert.match(healthyMarkup, /Database workbench/)
assert.match(healthyMarkup, /SQL editor/)
assert.match(healthyMarkup, /Inspect rows/)
assert.doesNotMatch(healthyMarkup, /Check connection/)
assert.match(healthyMarkup, /Connection/)
assert.match(healthyMarkup, /id="database-workbench-content" hidden=""/)
assert.match(healthyMarkup, /public\.users/)
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
assert.match(unavailableMarkup, /Not verified/)
assert.match(unavailableMarkup, /Query activity unavailable/)
assert.doesNotMatch(unavailableMarkup, /password authentication failed/i)

const storage: NonNullable<DatabaseOverview['storage']> = {
    sampledAt: healthyOverview.generatedAt, host: 'Inspur',
    disk: { availableBytes: 100e9, totalBytes: 2e12, dailyGrowthBytes: 50e9, daysUntilFull: 2, sampleSeconds: 86400 },
    instances: [
        { id: 'cdn_database', engine: 'PostgreSQL', status: 'healthy', databases: [{ name: 'cdn', sizeBytes: 16e9, connections: 3, tableCount: 42 }] },
        { id: 'replica', engine: 'PostgreSQL', status: 'unhealthy', databases: [{ name: 'hanasand', sizeBytes: 250e9, connections: 0, replica: true }] },
    ],
}
const storageMarkup = renderToStaticMarkup(React.createElement(DatabaseDashboard, { overview: { ...healthyOverview, storage } }))
for (const label of ['cdn_database', '16.00 GB', 'Replica', '1 need attention', '2 days', '+50.00 GB', '>42<']) assert(storageMarkup.includes(label), label)
assert(storageMarkup.indexOf('Database workbench') < storageMarkup.indexOf('Storage and databases'))
const staleMarkup = renderToStaticMarkup(React.createElement(DatabaseDashboard, { overview: { ...healthyOverview, storage: { ...storage, stale: true } } }))
assert(staleMarkup.includes('Not verified'))
assert(!staleMarkup.includes('2 days'))

assert.match(frontendApi, /requestService<DatabaseHealth>\('internal', 'db\/health'\)/, 'frontend should call the Hanasand liveness endpoint')
assert.match(frontendApi, /requestService<DatabaseQueryResult>\('internal', 'db\/query'/, 'frontend should call the Hanasand SQL endpoint')
assert.match(frontendApi, /requestService<DatabaseQueryResult>\('internal', `db\/rows\?/, 'frontend should call the Hanasand row inspection endpoint')
assert.match(apiRoutes, /fastify\.get\('\/db\/health', getDatabaseHealth\)/, 'API should expose GET /db/health')
assert.match(apiRoutes, /fastify\.get\('\/db\/rows', getDatabaseRows\)/, 'API should expose GET /db/rows')
assert.match(apiRoutes, /fastify\.post\('\/db\/query', postDatabaseQuery\)/, 'API should expose POST /db/query')

console.log('Database dashboard render checks passed.')
