import run from '#db'

export default async function ensureSchema() {
    await run('ALTER TABLE load_tests ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id) ON DELETE SET NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_load_tests_created_at ON load_tests(created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_load_tests_owner_created_at ON load_tests(owner_id, created_at DESC)')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by TEXT')
    await run('ALTER TABLE tokens ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT \'\'')
    await run('ALTER TABLE tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()')
    await run('ALTER TABLE tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ')
    await run('ALTER TABLE tokens ADD COLUMN IF NOT EXISTS revoked_by TEXT')
    await run(`
        CREATE TABLE IF NOT EXISTS login_events (
            id BIGSERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_id INT,
            ip TEXT NOT NULL,
            user_agent TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL,
            reason TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `)
    await run(`
        CREATE TABLE IF NOT EXISTS service_monitor_results (
            id BIGSERIAL PRIMARY KEY,
            service TEXT NOT NULL,
            check_name TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('up', 'degraded', 'down')),
            latency_ms INT NOT NULL DEFAULT 0,
            message TEXT,
            checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_service_monitor_results_checked_at ON service_monitor_results(checked_at)')
    await run('CREATE INDEX IF NOT EXISTS idx_service_monitor_results_service_check ON service_monitor_results(service, check_name, checked_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS service_logs (
            id BIGSERIAL PRIMARY KEY,
            service TEXT NOT NULL,
            host TEXT NOT NULL DEFAULT 'local',
            level TEXT NOT NULL DEFAULT 'info',
            message TEXT NOT NULL,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_service_logs_created_at ON service_logs(created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_service_logs_service_level ON service_logs(service, level, created_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS ai_conversations (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT 'New chat',
            preferred_model TEXT,
            active_model TEXT,
            model_strategy TEXT NOT NULL DEFAULT 'auto' CHECK (model_strategy IN ('auto', 'pinned')),
            workspace_kind TEXT CHECK (workspace_kind IN ('share', 'repo')),
            workspace_id TEXT,
            share_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
            workspace_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
            archived_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ')
    await run(`
        CREATE TABLE IF NOT EXISTS ai_conversation_collaborators (
            conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('reviewer', 'editor')),
            invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_accessed_at TIMESTAMPTZ,
            PRIMARY KEY (conversation_id, user_id)
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_ai_conversation_collaborators_user ON ai_conversation_collaborators(user_id, created_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS ai_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
            content TEXT NOT NULL DEFAULT '',
            pending BOOLEAN NOT NULL DEFAULT FALSE,
            error BOOLEAN NOT NULL DEFAULT FALSE,
            model_name TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run(`
        CREATE TABLE IF NOT EXISTS ai_imported_repositories (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            full_name TEXT NOT NULL,
            branch TEXT NOT NULL,
            default_branch TEXT NOT NULL DEFAULT 'main',
            source_path TEXT NOT NULL DEFAULT '',
            source_url TEXT NOT NULL,
            auth_mode TEXT NOT NULL DEFAULT 'public',
            auth_hint TEXT,
            github_token_encrypted TEXT,
            github_token_hint TEXT,
            github_token_attached_at TIMESTAMPTZ,
            github_token_last_used_at TIMESTAMPTZ,
            github_token_last_validated_at TIMESTAMPTZ,
            sync_status TEXT NOT NULL DEFAULT 'ready',
            last_synced_at TIMESTAMPTZ,
            last_sync_error TEXT,
            sync_history JSONB NOT NULL DEFAULT '[]'::jsonb,
            truncated BOOLEAN NOT NULL DEFAULT FALSE,
            imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS default_branch TEXT NOT NULL DEFAULT \'main\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS source_path TEXT NOT NULL DEFAULT \'\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS auth_mode TEXT NOT NULL DEFAULT \'public\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS auth_hint TEXT')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_encrypted TEXT')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_hint TEXT')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_attached_at TIMESTAMPTZ')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_last_used_at TIMESTAMPTZ')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_last_validated_at TIMESTAMPTZ')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT \'ready\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS last_sync_error TEXT')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS sync_history JSONB NOT NULL DEFAULT \'[]\'::jsonb')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS truncated BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS stack_type TEXT NOT NULL DEFAULT \'unknown\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS stack_reason TEXT')
    await run(`
        CREATE TABLE IF NOT EXISTS ai_imported_repository_files (
            repository_id TEXT NOT NULL REFERENCES ai_imported_repositories(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            name TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (repository_id, path)
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner_updated_at ON ai_conversations(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created_at ON ai_messages(conversation_id, created_at ASC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_repositories_owner_imported_at ON ai_imported_repositories(owner_id, imported_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS ai_deployments (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
            repository_id TEXT REFERENCES ai_imported_repositories(id) ON DELETE SET NULL,
            workspace_kind TEXT CHECK (workspace_kind IN ('share', 'repo')),
            workspace_id TEXT,
            vm_name TEXT NOT NULL,
            service_name TEXT NOT NULL DEFAULT 'workspace',
            status TEXT NOT NULL CHECK (status IN ('planned', 'syncing', 'building', 'running', 'healthchecking', 'blocked', 'failed')),
            preview_url TEXT,
            healthcheck_url TEXT,
            events JSONB NOT NULL DEFAULT '[]'::jsonb,
            failure_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        )
    `)
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS repository_id TEXT REFERENCES ai_imported_repositories(id) ON DELETE SET NULL')
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS service_name TEXT NOT NULL DEFAULT \'workspace\'')
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS stack_type TEXT NOT NULL DEFAULT \'unknown\'')
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS access_policy TEXT NOT NULL DEFAULT \'owner_only\'')
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS started_by TEXT REFERENCES users(id) ON DELETE SET NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_deployments_owner_updated_at ON ai_deployments(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_deployments_conversation ON ai_deployments(conversation_id, updated_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS ai_releases (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
            deployment_id TEXT REFERENCES ai_deployments(id) ON DELETE SET NULL,
            vm_name TEXT NOT NULL,
            stack_type TEXT NOT NULL DEFAULT 'unknown',
            access_policy TEXT NOT NULL DEFAULT 'owner_only',
            status TEXT NOT NULL DEFAULT 'current',
            preview_url TEXT,
            created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            notes TEXT
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_ai_releases_owner_updated_at ON ai_releases(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_releases_conversation ON ai_releases(conversation_id, updated_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS ai_usage_events (
            id BIGSERIAL PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            conversation_id TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE,
            repository_id TEXT REFERENCES ai_imported_repositories(id) ON DELETE SET NULL,
            deployment_id TEXT REFERENCES ai_deployments(id) ON DELETE SET NULL,
            release_id TEXT REFERENCES ai_releases(id) ON DELETE SET NULL,
            workspace_kind TEXT CHECK (workspace_kind IN ('share', 'repo')),
            workspace_id TEXT,
            kind TEXT NOT NULL CHECK (kind IN (
                'conversation_created',
                'message_written',
                'deployment_started',
                'release_recorded',
                'rollback_marked',
                'collaborator_invited',
                'collaborator_removed'
            )),
            units INT NOT NULL DEFAULT 1,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_owner_created_at ON ai_usage_events(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_conversation_created_at ON ai_usage_events(conversation_id, created_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS mail_accounts (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            mail_username TEXT NOT NULL UNIQUE,
            mail_address TEXT NOT NULL UNIQUE,
            mail_password_encrypted TEXT NOT NULL,
            principal_id INT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run(`
        CREATE TABLE IF NOT EXISTS mail_filters (
            id BIGSERIAL PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
            action JSONB NOT NULL DEFAULT '{}'::jsonb,
            priority INT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_mail_filters_user_priority ON mail_filters(user_id, priority ASC, id ASC)')
    await run(`
        CREATE TABLE IF NOT EXISTS mail_recent_recipients (
            owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            mailbox_user TEXT NOT NULL,
            email TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            use_count INT NOT NULL DEFAULT 1,
            last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (owner_user_id, mailbox_user, email)
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_mail_recent_recipients_lookup ON mail_recent_recipients(owner_user_id, mailbox_user, last_used_at DESC)')
}
