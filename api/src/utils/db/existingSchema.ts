import type run from '#db'

// Even IF NOT EXISTS can take a conflicting table lock before noticing an
// object is already installed. Inspect catalogs first; missing objects still
// run the real, idempotent migration under the normal schema lock limits.
export async function ensureColumn(query: typeof run, table: string, column: string, statement: string) {
    const existing = await query('SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass($1) AND attname=$2 AND attnum>0 AND NOT attisdropped', [table, column])
    if (!existing.rows.length) await query(statement)
}

export async function ensureIndex(query: typeof run, index: string, statement: string) {
    const existing = (await query('SELECT indisvalid,indisready FROM pg_index WHERE indexrelid=to_regclass($1)', [index])).rows[0]
    if (existing && (!existing.indisvalid || !existing.indisready)) throw new Error(`Existing schema index is not ready: ${index}`)
    if (!existing) await query(statement)
}

export async function ensureMillSourceConstraint(query: typeof run) {
    const existing = (await query('SELECT pg_get_constraintdef(oid) AS definition,convalidated FROM pg_constraint WHERE conrelid=to_regclass(\'mill_rules\') AND conname=\'mill_rules_source_check\'')).rows[0]
    const expected = 'CHECK ((source = ANY (ARRAY[\'owned\'::text, \'open_source\'::text, \'hanasand\'::text])))'
    if (existing?.convalidated && existing.definition === expected) return
    await query('ALTER TABLE mill_rules DROP CONSTRAINT IF EXISTS mill_rules_source_check; ALTER TABLE mill_rules ADD CONSTRAINT mill_rules_source_check CHECK (source IN (\'owned\', \'open_source\', \'hanasand\'))')
}
