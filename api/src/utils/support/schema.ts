import run, { independentSupport } from './db.ts'

export default async function ensureSupportAiSchema() {
    if (independentSupport) {
        await run('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL)')
        await run(`CREATE TABLE IF NOT EXISTS support_tickets (id UUID PRIMARY KEY, user_id TEXT REFERENCES users(id),
            subject TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
        await run(`CREATE TABLE IF NOT EXISTS support_messages (id UUID PRIMARY KEY, ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
            sender_id TEXT REFERENCES users(id), body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
        await run('CREATE INDEX IF NOT EXISTS idx_support_tickets_updated ON support_tickets(updated_at DESC)')
        await run('CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created ON support_messages(ticket_id,created_at)')
        await run(`CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (bucket_key TEXT PRIMARY KEY,
            window_started_at TIMESTAMPTZ NOT NULL, request_count INTEGER NOT NULL, updated_at TIMESTAMPTZ NOT NULL)`)
        await run(`CREATE TABLE IF NOT EXISTS support_auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
            snapshot JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`)
        await run('CREATE INDEX IF NOT EXISTS idx_support_auth_expiry ON support_auth_sessions(expires_at)')
    }
    await run('ALTER TABLE support_tickets ALTER COLUMN user_id DROP NOT NULL')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT \'human\' CHECK (channel IN (\'ai\', \'human\'))')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS visitor_token_hash TEXT')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_pending_id UUID')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_pending_at TIMESTAMPTZ')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_support_visitor_token ON support_tickets(visitor_token_hash) WHERE visitor_token_hash IS NOT NULL')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS visitor_session_hash TEXT')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolution_version INTEGER NOT NULL DEFAULT 0')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5)')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS feedback_comment TEXT')
    await run('ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS event TEXT CHECK (event IN (\'resolved\',\'reopened\',\'feedback\'))')
    await run('CREATE INDEX IF NOT EXISTS idx_support_visitor_chats ON support_tickets(COALESCE(visitor_session_hash, visitor_token_hash), updated_at DESC)')
    await run('ALTER TABLE support_messages ALTER COLUMN sender_id DROP NOT NULL')
    await run('ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_kind TEXT NOT NULL DEFAULT \'user\' CHECK (sender_kind IN (\'user\', \'assistant\', \'support\', \'system\'))')
    await run('ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS request_id UUID')
    await run('ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES support_messages(id) ON DELETE SET NULL')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_support_message_request ON support_messages(ticket_id, request_id) WHERE request_id IS NOT NULL')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_support_message_reply ON support_messages(reply_to) WHERE reply_to IS NOT NULL')
    await run(`CREATE TABLE IF NOT EXISTS support_live_tickets (
        token_hash TEXT PRIMARY KEY, visitor_token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL
    )`)
    await run('CREATE INDEX IF NOT EXISTS idx_support_live_expiry ON support_live_tickets(expires_at)')
    // Transactional notifications reach every API replica only after messages are committed.
    await run(`CREATE OR REPLACE FUNCTION notify_support_change() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE ticket support_tickets%ROWTYPE;
        BEGIN
            IF TG_TABLE_NAME = 'support_messages' THEN SELECT * INTO ticket FROM support_tickets WHERE id = NEW.ticket_id;
            ELSE ticket := NEW; END IF;
            PERFORM pg_notify('support_changed', json_build_object('id', ticket.id, 'visitor', COALESCE(ticket.visitor_session_hash, ticket.visitor_token_hash),
                'user', ticket.user_id, 'channel', ticket.channel)::text);
            RETURN NEW;
        END $$`)
    await run(`CREATE OR REPLACE TRIGGER support_ticket_changed AFTER INSERT OR UPDATE ON support_tickets
        FOR EACH ROW EXECUTE FUNCTION notify_support_change()`)
    await run(`CREATE OR REPLACE TRIGGER support_message_changed AFTER INSERT ON support_messages
        FOR EACH ROW EXECUTE FUNCTION notify_support_change()`)
}
