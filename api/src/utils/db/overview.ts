type QueryParams = Array<string | number | boolean | null>
type MetricsQuery = <T extends Record<string, unknown>>(query: string, params?: QueryParams) => Promise<{ rows: T[] }>

export type DatabaseQueryActivity = {
    database: string | null
    user: string | null
    state: string | null
    durationSeconds: number | null
    waitEventType: string | null
    waitEvent: string | null
    query: string | null
    isLongRunning: boolean
}

export type DatabaseOverview = {
    status: 'healthy' | 'unavailable'
    generatedAt: string
    clusterCount: number | null
    databaseCount: number | null
    totalSizeBytes: number | null
    activeQueries: number | null
    averageQuerySeconds: number | null
    longRunningThresholdSeconds: number
    longestQuery: DatabaseQueryActivity | null
    queries: DatabaseQueryActivity[]
    health: {
        message: string
        detail?: string
        category?: 'auth' | 'network' | 'permission' | 'unknown'
    }
    clusters: Array<{
        id: string
        name: string
        engine: string
        version: string
        host: string
        activeQueries: number
        totalSizeBytes: number
        databaseCount: number
        error?: string | null
        databases: Array<{
            name: string
            sizeBytes: number
            tableCount: number | null
            activeConnections: number
        }>
    }>
}

type ServerRow = {
    current_database: string
    host: string | null
    port: number | null
    version: string
}

type DatabaseRow = {
    name: string
    size_bytes: string | number | null
    table_count: string | number | null
    active_connections: string | number | null
}

type ActivityRow = {
    database: string | null
    user_name: string | null
    state: string | null
    duration_seconds: string | number | null
    wait_event_type: string | null
    wait_event: string | null
    query: string | null
}

export async function collectLiveDatabaseOverview() {
    const { queryOnce } = await import('#db')
    return collectDatabaseOverview(async <T extends Record<string, unknown>>(query: string, params?: QueryParams) => {
        const result = await queryOnce(query, params)
        return { rows: result.rows as T[] }
    })
}

export async function collectDatabaseOverview(query: MetricsQuery, now = new Date()): Promise<DatabaseOverview> {
    const generatedAt = now.toISOString()
    const longRunningThresholdSeconds = Math.max(Number(process.env.DB_LONG_QUERY_SECONDS || 60), 1)

    try {
        const [server, databases] = await Promise.all([
            query<ServerRow>(`
                SELECT
                    current_database() AS current_database,
                    inet_server_addr()::text AS host,
                    inet_server_port()::int AS port,
                    current_setting('server_version') AS version
            `),
            query<DatabaseRow>(`
                WITH connections AS (
                    SELECT datname, COUNT(*)::int AS active_connections
                    FROM pg_stat_activity
                    WHERE backend_type = 'client backend'
                    GROUP BY datname
                )
                SELECT
                    d.datname AS name,
                    pg_database_size(d.datname)::text AS size_bytes,
                    CASE
                        WHEN d.datname = current_database() THEN (
                            SELECT COUNT(*)::int
                            FROM information_schema.tables
                            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                        )
                        ELSE NULL
                    END AS table_count,
                    COALESCE(c.active_connections, 0)::int AS active_connections
                FROM pg_database d
                LEFT JOIN connections c ON c.datname = d.datname
                WHERE d.datallowconn
                  AND NOT d.datistemplate
                ORDER BY d.datname ASC
            `),
        ])
        const activity = await query<ActivityRow>(`
            SELECT
                datname AS database,
                usename AS user_name,
                state,
                GREATEST(EXTRACT(EPOCH FROM now() - query_start), 0)::float AS duration_seconds,
                wait_event_type,
                wait_event,
                LEFT(regexp_replace(COALESCE(query, ''), E'\\\\s+', ' ', 'g'), 500) AS query
            FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
              AND backend_type = 'client backend'
              AND query_start IS NOT NULL
              AND state <> 'idle'
            ORDER BY query_start ASC
            LIMIT 25
        `)

        const serverRow = server.rows[0]
        const databaseRows = databases.rows.map(row => ({
            name: String(row.name),
            sizeBytes: toNumber(row.size_bytes),
            tableCount: row.table_count === null ? null : toNumber(row.table_count),
            activeConnections: toNumber(row.active_connections),
        }))
        const queryRows = activity.rows.map(row => toQueryActivity(row, longRunningThresholdSeconds))
        const activeRows = queryRows.filter(row => row.state === 'active')
        const totalSizeBytes = databaseRows.reduce((sum, row) => sum + row.sizeBytes, 0)
        const longestQuery = queryRows[0] ?? null
        const averageQuerySeconds = activeRows.length
            ? activeRows.reduce((sum, row) => sum + (row.durationSeconds ?? 0), 0) / activeRows.length
            : null

        return {
            status: 'healthy',
            generatedAt,
            clusterCount: 1,
            databaseCount: databaseRows.length,
            totalSizeBytes,
            activeQueries: activeRows.length,
            averageQuerySeconds,
            longRunningThresholdSeconds,
            longestQuery,
            queries: queryRows,
            health: {
                message: 'Database metrics loaded from the live PostgreSQL telemetry views.',
            },
            clusters: [{
                id: 'primary-postgres',
                name: serverRow?.current_database ? `${serverRow.current_database} cluster` : 'PostgreSQL cluster',
                engine: 'PostgreSQL',
                version: serverRow?.version || 'version unavailable',
                host: formatHost(serverRow),
                activeQueries: activeRows.length,
                totalSizeBytes,
                databaseCount: databaseRows.length,
                error: null,
                databases: databaseRows,
            }],
        }
    } catch (error) {
        return unavailableOverview(error, generatedAt, longRunningThresholdSeconds)
    }
}

function toQueryActivity(row: ActivityRow, longRunningThresholdSeconds: number): DatabaseQueryActivity {
    const durationSeconds = row.duration_seconds === null ? null : Math.max(toNumber(row.duration_seconds), 0)
    return {
        database: row.database,
        user: row.user_name,
        state: row.state,
        durationSeconds,
        waitEventType: row.wait_event_type,
        waitEvent: row.wait_event,
        query: sanitizeQuery(row.query),
        isLongRunning: durationSeconds !== null && durationSeconds >= longRunningThresholdSeconds,
    }
}

function unavailableOverview(error: unknown, generatedAt: string, longRunningThresholdSeconds: number): DatabaseOverview {
    const sanitized = sanitizeDatabaseError(error)
    return {
        status: 'unavailable',
        generatedAt,
        clusterCount: null,
        databaseCount: null,
        totalSizeBytes: null,
        activeQueries: null,
        averageQuerySeconds: null,
        longRunningThresholdSeconds,
        longestQuery: null,
        queries: [],
        health: sanitized,
        clusters: [],
    }
}

export function sanitizeDatabaseError(error: unknown): DatabaseOverview['health'] {
    const err = error as { code?: string, message?: string }
    const code = err?.code || ''
    const message = (err?.message || '').toLowerCase()

    if (code === '28P01' || message.includes('password authentication failed')) {
        return {
            category: 'auth',
            message: 'Database metrics unavailable: the internal API cannot authenticate to PostgreSQL.',
            detail: 'Check DB_USER and DB_PASSWORD for the API service, then retry the dashboard.',
        }
    }

    if (code === '42501' || message.includes('permission denied')) {
        return {
            category: 'permission',
            message: 'Database metrics unavailable: the configured database user lacks telemetry permissions.',
            detail: 'Grant enough read access for pg_stat_activity, pg_database_size, and information_schema table counts.',
        }
    }

    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', '08000', '08001', '08003', '08006'].includes(code)
        || message.includes('timeout')
        || message.includes('connection refused')
        || message.includes('getaddrinfo')) {
        return {
            category: 'network',
            message: 'Database metrics unavailable: the internal API cannot reach PostgreSQL.',
            detail: 'Check DB_HOST, DB_PORT, service health, and network access from the API container.',
        }
    }

    return {
        category: 'unknown',
        message: 'Database metrics unavailable: PostgreSQL telemetry could not be read.',
        detail: 'Check the API logs for the database metrics request and verify the database connection settings.',
    }
}

function sanitizeQuery(value: string | null) {
    const trimmed = value?.trim()
    if (!trimmed) return null
    return trimmed.replace(/\b(password|token|secret|authorization)\s*=\s*('[^']*'|"[^"]*"|\S+)/gi, '$1=[redacted]')
}

function formatHost(row?: ServerRow) {
    const host = row?.host || process.env.DB_HOST || 'host unavailable'
    return row?.port ? `${host}:${row.port}` : host
}

function toNumber(value: string | number | null | undefined) {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
}
