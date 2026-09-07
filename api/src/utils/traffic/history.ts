import { queryOnce, withTransaction } from '../db.ts'
import { recoveryReadOnly } from '../resilience.ts'

export async function ensureTrafficHistorySchema() {
    await queryOnce(`
        CREATE TABLE IF NOT EXISTS traffic_history_state (
            singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
            covered_before timestamptz NOT NULL
        );
        CREATE TABLE IF NOT EXISTS traffic_history (
            key bytea PRIMARY KEY,
            bucket timestamptz NOT NULL,
            domain text NOT NULL, path text NOT NULL, method text NOT NULL,
            status integer NOT NULL, ip text NOT NULL, user_agent text NOT NULL,
            country_iso text NOT NULL,
            hits bigint NOT NULL, time_total double precision NOT NULL,
            first_seen timestamptz NOT NULL, last_seen timestamptz NOT NULL
        );
        CREATE INDEX IF NOT EXISTS traffic_history_bucket ON traffic_history(bucket);
        CREATE INDEX IF NOT EXISTS traffic_history_domain ON traffic_history(domain);
        INSERT INTO traffic_history_state(singleton, covered_before)
        SELECT true, COALESCE(date_trunc('hour', MIN(created_at)), date_trunc('hour', NOW() - INTERVAL '24 hours'))
        FROM traffic_events
        ON CONFLICT DO NOTHING;
        CREATE OR REPLACE VIEW traffic_aggregate_events AS
        SELECT domain,path,method,status,ip,user_agent,country_iso,bucket AS created_at,
               hits,time_total,first_seen,last_seen
        FROM traffic_history
        WHERE bucket < (SELECT covered_before FROM traffic_history_state)
          AND bucket <> date_trunc('hour', NOW() - INTERVAL '7 days')
        UNION ALL
        SELECT domain,path,method,status,ip,user_agent,country_iso,created_at,
               1::bigint,request_time_ms::double precision,created_at,created_at
        FROM traffic_events
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT domain,path,method,status,ip,user_agent,country_iso,created_at,
               1::bigint,request_time_ms::double precision,created_at,created_at
        FROM traffic_events
        WHERE created_at >= (SELECT covered_before FROM traffic_history_state)
          AND created_at < NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT domain,path,method,status,ip,user_agent,country_iso,created_at,
               1::bigint,request_time_ms::double precision,created_at,created_at
        FROM traffic_events
        WHERE created_at >= date_trunc('hour', NOW() - INTERVAL '7 days')
          AND created_at < LEAST(date_trunc('hour', NOW() - INTERVAL '7 days') + INTERVAL '1 hour',
                                (SELECT covered_before FROM traffic_history_state));
    `)
}

// Move settled hours into durable aggregates atomically. Readers see either
// the raw hour or its aggregate, never both. Historical raw records are retained.
export async function cacheTrafficHistoryHour(batchHours = 1): Promise<boolean> {
    return withTransaction(async query => {
        const lock = await query('SELECT pg_try_advisory_xact_lock(82417931) AS acquired')
        if (!lock.rows[0].acquired) return false
        const state = await query(`
            SELECT covered_before, LEAST(covered_before + ($1::int * INTERVAL '1 hour'), date_trunc('hour', NOW() - INTERVAL '24 hours')) AS next,
                   covered_before < date_trunc('hour', NOW() - INTERVAL '24 hours') AS pending
            FROM traffic_history_state WHERE singleton FOR UPDATE
        `, [Math.max(1, Math.min(24, Math.floor(batchHours)))])
        if (!state.rows[0]?.pending) return false
        const { covered_before: from, next: to } = state.rows[0]
        await query(`
            INSERT INTO traffic_history
                (key,bucket,domain,path,method,status,ip,user_agent,country_iso,hits,time_total,first_seen,last_seen)
            SELECT sha256(convert_to(jsonb_build_array(date_trunc('hour',created_at),domain,path,method,status,ip,user_agent,country_iso)::text,'UTF8')),
                   date_trunc('hour',created_at),domain,path,method,status,ip,user_agent,country_iso,
                   COUNT(*),SUM(request_time_ms)::double precision,MIN(created_at),MAX(created_at)
            FROM traffic_events WHERE created_at >= $1 AND created_at < $2
            GROUP BY date_trunc('hour',created_at),domain,path,method,status,ip,user_agent,country_iso
        `, [from, to])
        await query('UPDATE traffic_history_state SET covered_before=$1 WHERE singleton', [to])
        return true
    })
}

export function refreshTrafficHistory() {
    let running = false
    const refresh = async () => {
        if (running || recoveryReadOnly()) return
        running = true
        try {
            // Bound background work; catch-up is also available as a deployment job.
            for (let hour = 0; hour < 24 && await cacheTrafficHistoryHour(); hour++) { /* continue */ }
        } catch (error) {
            console.error('Traffic history refresh failed; raw traffic remains available', error)
        } finally {
            running = false
        }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 60000)
    timer.unref()
    return () => clearInterval(timer)
}
