import run from '#db'

export default async function ensureCaseDevelopmentSchema() {
    await run(`CREATE TABLE IF NOT EXISTS case_repositories (
        id UUID PRIMARY KEY, owner_id TEXT NOT NULL, organization_id TEXT,
        provider TEXT NOT NULL CHECK (provider IN ('github', 'forgejo', 'gitlab')),
        repository_url TEXT NOT NULL, secret_encrypted TEXT NOT NULL,
        last_received_at TIMESTAMPTZ, last_warning TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await run('CREATE UNIQUE INDEX IF NOT EXISTS case_repositories_scope_url ON case_repositories (owner_id, COALESCE(organization_id, \'\'), repository_url)')
    await run(`CREATE TABLE IF NOT EXISTS case_development (
        repository_id UUID NOT NULL REFERENCES case_repositories(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, external_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL,
        author TEXT NOT NULL, state TEXT NOT NULL, branch TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
        case_references TEXT[] NOT NULL, PRIMARY KEY (repository_id, kind, external_id)
    )`)
    await run('CREATE INDEX IF NOT EXISTS case_development_references ON case_development USING GIN (case_references)')
}
