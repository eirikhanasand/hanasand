import assert from 'node:assert/strict'
import { collectDatabaseOverview, sanitizeDatabaseError } from '../src/utils/db/overview.ts'

process.env.DB_LONG_QUERY_SECONDS = '60'

const generatedAt = new Date('2026-07-02T10:00:00.000Z')
let inventoryFinished = false
let activityStartedAfterInventory = false

const overview = await collectDatabaseOverview(async (query) => {
    if (query.includes('FROM pg_database d')) {
        await Promise.resolve()
        inventoryFinished = true
        return {
            rows: [
                { name: 'hanasand', size_bytes: '104857600', table_count: 42, active_connections: 4 },
                { name: 'postgres', size_bytes: '8388608', table_count: null, active_connections: 1 },
            ],
        }
    }

    if (query.includes('current_database()')) {
        return {
            rows: [{
                current_database: 'hanasand',
                host: '10.0.0.5',
                port: 5432,
                version: '16.4',
            }],
        }
    }

    if (query.includes('FROM pg_stat_activity')) {
        activityStartedAfterInventory = inventoryFinished
        return {
            rows: [
                {
                    database: 'hanasand',
                    user_name: 'app',
                    state: 'active',
                    duration_seconds: 125,
                    wait_event_type: 'Lock',
                    wait_event: 'transactionid',
                    query: 'select * from users where token=\'secret-value\'',
                },
                {
                    database: 'hanasand',
                    user_name: 'worker',
                    state: 'active',
                    duration_seconds: -0.5,
                    wait_event_type: null,
                    wait_event: null,
                    query: 'select 1',
                },
            ],
        }
    }

    throw new Error(`Unexpected query: ${query}`)
}, generatedAt)

assert.equal(overview.status, 'healthy')
assert.equal(overview.clusterCount, 1)
assert.equal(overview.databaseCount, 2)
assert.equal(overview.totalSizeBytes, 113246208)
assert.equal(overview.activeQueries, 2)
assert.equal(Math.round(overview.averageQuerySeconds || 0), 63)
assert.equal(overview.longestQuery?.database, 'hanasand')
assert.equal(overview.longestQuery?.isLongRunning, true)
assert.match(overview.longestQuery?.query || '', /token=\[redacted\]/)
assert.equal(overview.queries[1]?.durationSeconds, 0)
assert.equal(overview.clusters[0]?.databases[0]?.tableCount, 42)
assert.equal(activityStartedAfterInventory, true, 'Activity sampling should run after inventory queries to avoid self-noise.')

const unavailable = await collectDatabaseOverview(async () => {
    throw Object.assign(new Error('password authentication failed for user "hanasand"'), { code: '28P01' })
}, generatedAt)

assert.equal(unavailable.status, 'unavailable')
assert.equal(unavailable.clusterCount, null)
assert.equal(unavailable.databaseCount, null)
assert.match(unavailable.health.message, /cannot authenticate/i)
assert.doesNotMatch(unavailable.health.message, /hanasand/)
assert.doesNotMatch(unavailable.health.detail || '', /password authentication failed/i)

const networkError = sanitizeDatabaseError(Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432'), { code: 'ECONNREFUSED' }))
assert.equal(networkError.category, 'network')
assert.match(networkError.detail || '', /DB_HOST/)

console.log('Database overview checks passed.')
