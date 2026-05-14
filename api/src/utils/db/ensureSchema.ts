import run from '#db'
import { reservedUsernames } from '#utils/auth/reservedUsernames.ts'

export default async function ensureSchema() {
    await run('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    await run('ALTER TABLE load_tests ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id) ON DELETE SET NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_load_tests_created_at ON load_tests(created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_load_tests_owner_created_at ON load_tests(owner_id, created_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS load_test_runs (
            id BIGSERIAL PRIMARY KEY,
            test_id TEXT NOT NULL REFERENCES load_tests(id) ON DELETE CASCADE,
            run_number INT NOT NULL,
            url TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'running',
            exit_code INT,
            summary JSONB NOT NULL DEFAULT '{}'::jsonb,
            started_at TIMESTAMP NOT NULL DEFAULT NOW(),
            finished_at TIMESTAMP,
            duration_ms INT,
            UNIQUE(test_id, run_number)
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_load_test_runs_test_started_at ON load_test_runs(test_id, started_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_load_test_runs_url_started_at ON load_test_runs(url, started_at DESC)')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by TEXT')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS reserved BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_restore_token_hash TEXT')
    await run('ALTER TABLE vms ADD COLUMN IF NOT EXISTS always_running_premium BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE vms ADD COLUMN IF NOT EXISTS always_running_enabled BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE vms ADD COLUMN IF NOT EXISTS failover_premium BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE vms ADD COLUMN IF NOT EXISTS failover_enabled BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE vms ADD COLUMN IF NOT EXISTS primary_host TEXT NOT NULL DEFAULT $$ovhcloud$$')
    await run('ALTER TABLE vms ADD COLUMN IF NOT EXISTS failover_host TEXT')
    if ((process.env.VM_HOST_ID || '') === 'inspur') {
        await run(`
            UPDATE vms v
            SET primary_host = 'inspur'
            WHERE LOWER(COALESCE(v.primary_host, '')) = 'ovhcloud'
              AND EXISTS (SELECT 1 FROM vm_details d WHERE LOWER(d.name) = LOWER(v.name))
        `)
    }
    await run('ALTER TABLE vm_details DROP CONSTRAINT IF EXISTS vm_details_name_fkey')
    await run('ALTER TABLE vm_details ADD CONSTRAINT vm_details_name_fkey FOREIGN KEY (name) REFERENCES vms(name) ON DELETE CASCADE ON UPDATE CASCADE')
    await run(`
        INSERT INTO users (id, name, password, avatar, active, reserved)
        SELECT id, name, crypt(gen_random_uuid()::text, gen_salt('bf')), '', FALSE, TRUE
        FROM unnest($1::text[], $2::text[]) AS reserved(id, name)
        ON CONFLICT (id) DO NOTHING
    `, [
        reservedUsernames,
        reservedUsernames.map(username => `${username} reserved account`),
    ])
    await run('UPDATE users SET reserved = TRUE WHERE lower(id) = ANY($1::text[])', [reservedUsernames])
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
        CREATE TABLE IF NOT EXISTS impersonation_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            token_hash TEXT NOT NULL UNIQUE,
            actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reason TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ,
            revoked_by TEXT REFERENCES users(id) ON DELETE SET NULL
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_actor_active ON impersonation_sessions(actor_id, expires_at DESC) WHERE revoked_at IS NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target_created ON impersonation_sessions(target_id, created_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS impersonation_events (
            id BIGSERIAL PRIMARY KEY,
            session_id UUID REFERENCES impersonation_sessions(id) ON DELETE SET NULL,
            actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            method TEXT NOT NULL DEFAULT '',
            path TEXT NOT NULL DEFAULT '',
            ip TEXT NOT NULL DEFAULT '',
            user_agent TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('ALTER TABLE impersonation_events ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES impersonation_sessions(id) ON DELETE SET NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_events_actor_created ON impersonation_events(actor_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_events_target_created ON impersonation_events(target_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_events_route_recent ON impersonation_events(actor_id, target_id, method, path, created_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS share (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            git TEXT,
            locked BOOLEAN NOT NULL DEFAULT FALSE,
            owner TEXT NOT NULL DEFAULT 'anonymous',
            parent TEXT NOT NULL DEFAULT '',
            alias TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL DEFAULT 'file' CHECK (type IN ('file', 'folder')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_share_owner_updated ON share(owner, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_share_parent ON share(parent)')
    await run('CREATE INDEX IF NOT EXISTS idx_share_alias ON share(alias)')
    await run(`
        CREATE TABLE IF NOT EXISTS password_reset_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            code_hash TEXT NOT NULL,
            reset_token_hash TEXT,
            requested_ip TEXT NOT NULL DEFAULT '',
            user_agent TEXT NOT NULL DEFAULT '',
            attempts INT NOT NULL DEFAULT 0,
            expires_at TIMESTAMPTZ NOT NULL,
            verified_at TIMESTAMPTZ,
            consumed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user_active ON password_reset_codes(user_id, consumed_at, expires_at DESC)')
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
        CREATE TABLE IF NOT EXISTS desktop_agent_presence (
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            device_id TEXT NOT NULL,
            device_name TEXT NOT NULL DEFAULT 'Mac',
            endpoints TEXT[] NOT NULL DEFAULT '{}'::text[],
            agent_token TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (owner_id, device_id)
        )
    `)
    await run('ALTER TABLE desktop_agent_presence ALTER COLUMN agent_token SET DEFAULT \'\'')
    await run('CREATE INDEX IF NOT EXISTS idx_desktop_agent_presence_owner_updated ON desktop_agent_presence(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_desktop_agent_presence_expires ON desktop_agent_presence(expires_at)')
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
        CREATE TABLE IF NOT EXISTS agent_automations (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            prompt TEXT NOT NULL,
            schedule_kind TEXT NOT NULL CHECK (schedule_kind IN ('once', 'interval')),
            interval_minutes INT,
            run_at TIMESTAMPTZ,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
            action_type TEXT NOT NULL DEFAULT 'agent_prompt' CHECK (action_type IN ('agent_prompt', 'echo')),
            timezone TEXT NOT NULL DEFAULT 'UTC',
            model_name TEXT,
            notify_on TEXT NOT NULL DEFAULT 'failure' CHECK (notify_on IN ('never', 'failure', 'always')),
            next_run_at TIMESTAMPTZ,
            last_run_at TIMESTAMPTZ,
            last_completed_at TIMESTAMPTZ,
            last_status TEXT,
            last_result TEXT,
            last_error TEXT,
            consecutive_failures INT NOT NULL DEFAULT 0,
            paused_reason TEXT,
            run_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT \'UTC\'')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS model_name TEXT')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS notify_on TEXT NOT NULL DEFAULT \'failure\'')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS paused_reason TEXT')
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automations_owner_updated ON agent_automations(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automations_due ON agent_automations(status, next_run_at)')
    await run(`
        CREATE TABLE IF NOT EXISTS agent_automation_runs (
            id TEXT PRIMARY KEY,
            automation_id TEXT NOT NULL REFERENCES agent_automations(id) ON DELETE CASCADE,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
            result TEXT,
            error TEXT,
            provider TEXT,
            model TEXT,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            duration_ms INT
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automation_runs_automation_started ON agent_automation_runs(automation_id, started_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automation_runs_owner_started ON agent_automation_runs(owner_id, started_at DESC)')
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
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT 'Untitled',
            content TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT 'api',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_notes_owner_updated_at ON notes(owner_id, updated_at DESC, created_at DESC)')
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
                'ai_run_completed',
                'ai_run_failed',
                'ai_run_platform_error',
                'browser_proof_completed',
                'build_minutes_recorded',
                'deploy_minutes_recorded',
                'cache_hit',
                'deployment_started',
                'release_recorded',
                'rollback_marked',
                'collaborator_invited',
                'collaborator_removed'
            )),
            units INT NOT NULL DEFAULT 1,
            billable_units INT NOT NULL DEFAULT 1,
            estimated_cost_nok NUMERIC(12,4) NOT NULL DEFAULT 0,
            billing_mode TEXT NOT NULL DEFAULT 'standard',
            outcome TEXT NOT NULL DEFAULT 'unverified',
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('ALTER TABLE ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_kind_check')
    await run(`
        ALTER TABLE ai_usage_events
        ADD CONSTRAINT ai_usage_events_kind_check CHECK (kind IN (
            'conversation_created',
            'message_written',
            'ai_run_completed',
            'ai_run_failed',
            'ai_run_platform_error',
            'browser_proof_completed',
            'build_minutes_recorded',
            'deploy_minutes_recorded',
            'cache_hit',
            'deployment_started',
            'release_recorded',
            'rollback_marked',
            'collaborator_invited',
            'collaborator_removed'
        ))
    `)
    await run('ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS billable_units INT NOT NULL DEFAULT 1')
    await run('ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS estimated_cost_nok NUMERIC(12,4) NOT NULL DEFAULT 0')
    await run('ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT \'standard\'')
    await run('ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT \'unverified\'')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_owner_created_at ON ai_usage_events(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_conversation_created_at ON ai_usage_events(conversation_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_owner_kind_created ON ai_usage_events(owner_id, kind, created_at DESC)')
    await run(`
        CREATE TABLE IF NOT EXISTS ai_verification_jobs (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            workspace_kind TEXT,
            workspace_id TEXT,
            kind TEXT NOT NULL CHECK (kind IN ('browser', 'build', 'deploy', 'design')),
            status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
            priority INT NOT NULL DEFAULT 0,
            lane TEXT NOT NULL DEFAULT 'standard',
            queue_position INT NOT NULL DEFAULT 0,
            retry_count INT NOT NULL DEFAULT 0,
            max_retries INT NOT NULL DEFAULT 1,
            current_step TEXT NOT NULL DEFAULT 'Queued',
            target_url TEXT,
            deploy_url TEXT,
            request_id TEXT NOT NULL,
            artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ
        )
    `)
    await run('ALTER TABLE ai_verification_jobs DROP CONSTRAINT IF EXISTS ai_verification_jobs_kind_check')
    await run('ALTER TABLE ai_verification_jobs ADD CONSTRAINT ai_verification_jobs_kind_check CHECK (kind IN (\'browser\', \'build\', \'deploy\', \'design\'))')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_verification_jobs_owner_created ON ai_verification_jobs(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_verification_jobs_workspace_created ON ai_verification_jobs(owner_id, workspace_kind, workspace_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_verification_jobs_queue ON ai_verification_jobs(status, priority DESC, created_at ASC)')
    await run(`
        CREATE TABLE IF NOT EXISTS api_rate_limit_settings (
            id TEXT PRIMARY KEY,
            config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run(`
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            tier TEXT NOT NULL DEFAULT 'custom',
            description TEXT,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            key_prefix TEXT NOT NULL UNIQUE,
            secret_hash TEXT NOT NULL,
            expires_at TIMESTAMPTZ,
            last_used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run(`
        CREATE TABLE IF NOT EXISTS api_key_scopes (
            id TEXT PRIMARY KEY,
            api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
            method TEXT NOT NULL,
            route TEXT NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            per_second INT,
            per_minute INT,
            per_hour INT,
            per_day INT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_api_keys_owner_created_at ON api_keys(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)')
    await run('CREATE INDEX IF NOT EXISTS idx_api_key_scopes_key_route ON api_key_scopes(api_key_id, method, route)')
    await run(`
        CREATE TABLE IF NOT EXISTS mail_accounts (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            mail_username TEXT NOT NULL UNIQUE,
            mail_address TEXT NOT NULL UNIQUE,
            recovery_email TEXT,
            mail_password_encrypted TEXT NOT NULL,
            principal_id INT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('ALTER TABLE mail_accounts ADD COLUMN IF NOT EXISTS recovery_email TEXT')
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
