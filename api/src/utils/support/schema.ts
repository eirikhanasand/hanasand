import run from '#db'

export default async function ensureSupportAiSchema() {
    await run('ALTER TABLE support_tickets ALTER COLUMN user_id DROP NOT NULL')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT \'human\' CHECK (channel IN (\'ai\', \'human\'))')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS visitor_token_hash TEXT')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_pending_id UUID')
    await run('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_pending_at TIMESTAMPTZ')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_support_visitor_token ON support_tickets(visitor_token_hash) WHERE visitor_token_hash IS NOT NULL')
    await run('ALTER TABLE support_messages ALTER COLUMN sender_id DROP NOT NULL')
    await run('ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_kind TEXT NOT NULL DEFAULT \'user\' CHECK (sender_kind IN (\'user\', \'assistant\', \'support\', \'system\'))')
    await run('ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS request_id UUID')
    await run('ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES support_messages(id) ON DELETE SET NULL')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_support_message_request ON support_messages(ticket_id, request_id) WHERE request_id IS NOT NULL')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_support_message_reply ON support_messages(reply_to) WHERE reply_to IS NOT NULL')
}
