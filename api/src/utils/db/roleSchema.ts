import run from '#db'

export default async function ensureRoleSchema() {
    await run('ALTER TABLE roles ADD COLUMN IF NOT EXISTS icon TEXT')
    await run(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='roles'::regclass AND conname='roles_administrator_priority') THEN
            ALTER TABLE roles ADD CONSTRAINT roles_administrator_priority CHECK (
                (id='administrator' AND priority=0) OR (id<>'administrator' AND priority>0)
            );
        END IF;
    END $$`)
}
