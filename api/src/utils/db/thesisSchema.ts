import { queryOnce } from '#db'

export default async function ensureThesisSchema() {
    await queryOnce(`
        CREATE TABLE IF NOT EXISTS thesis (
            id SMALLINT PRIMARY KEY CHECK (id = 1),
            title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 500),
            content TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 1000000),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await queryOnce('INSERT INTO thesis (id, title, content) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING', ['# Thesis', ''])
}
