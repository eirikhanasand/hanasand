import run from '#db'

let ready: Promise<unknown> | undefined
export function ensureStatusSnapshots() {
    return ready ||= run('CREATE TABLE IF NOT EXISTS service_status_snapshots (id text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT NOW())')
        .catch(error => { ready = undefined; throw error })
}
