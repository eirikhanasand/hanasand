import run, { withTransaction } from '#db'

export default async function ensureRuleHitCountSchema() {
    await run(`CREATE TABLE IF NOT EXISTS rule_hit_counts (
        organization_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('findings', 'receipts')),
        rule_id TEXT NOT NULL,
        hits BIGINT NOT NULL DEFAULT 0 CHECK (hits >= 0),
        PRIMARY KEY (organization_id, source, rule_id)
    )`)
    await run(`CREATE TABLE IF NOT EXISTS rule_hit_count_state (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
        initialized BOOLEAN NOT NULL DEFAULT FALSE
    )`)
    await run('INSERT INTO rule_hit_count_state(id, initialized) VALUES(TRUE, FALSE) ON CONFLICT(id) DO NOTHING')
    await withTransaction(async query => {
        const state = await query('SELECT initialized FROM rule_hit_count_state WHERE id=TRUE FOR UPDATE')
        if (state.rows[0]?.initialized) return
        await query('LOCK TABLE findings, log_analyze_receipts IN SHARE ROW EXCLUSIVE MODE')
        await query(`INSERT INTO rule_hit_counts(organization_id, source, rule_id, hits)
            SELECT organization_id, source, rule_id, count(*) FROM (
                SELECT organization_id, 'findings'::text AS source, rule_id FROM findings
                UNION ALL
                SELECT organization_id, 'receipts'::text AS source, rule_id FROM log_analyze_receipts
            ) AS rule_hits GROUP BY organization_id, source, rule_id
            ON CONFLICT(organization_id, source, rule_id) DO UPDATE SET hits=EXCLUDED.hits`)
        await query(`CREATE OR REPLACE FUNCTION maintain_rule_hit_count() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE hit_source TEXT := CASE WHEN TG_TABLE_NAME = 'findings' THEN 'findings' ELSE 'receipts' END;
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO rule_hit_counts(organization_id, source, rule_id, hits) VALUES(NEW.organization_id, hit_source, NEW.rule_id, 1)
                ON CONFLICT(organization_id, source, rule_id) DO UPDATE SET hits=rule_hit_counts.hits+1;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE rule_hit_counts SET hits=GREATEST(hits-1, 0)
                WHERE organization_id=OLD.organization_id AND source=hit_source AND rule_id=OLD.rule_id;
                RETURN OLD;
            ELSIF (OLD.organization_id, OLD.rule_id) IS DISTINCT FROM (NEW.organization_id, NEW.rule_id) THEN
                UPDATE rule_hit_counts SET hits=GREATEST(hits-1, 0)
                WHERE organization_id=OLD.organization_id AND source=hit_source AND rule_id=OLD.rule_id;
                INSERT INTO rule_hit_counts(organization_id, source, rule_id, hits) VALUES(NEW.organization_id, hit_source, NEW.rule_id, 1)
                ON CONFLICT(organization_id, source, rule_id) DO UPDATE SET hits=rule_hit_counts.hits+1;
            END IF;
            RETURN NEW;
        END
        $$`)
        await query(`CREATE TRIGGER findings_rule_hit_count
            AFTER INSERT OR UPDATE OR DELETE ON findings
            FOR EACH ROW EXECUTE FUNCTION maintain_rule_hit_count()`)
        await query(`CREATE TRIGGER log_analyze_receipts_rule_hit_count
            AFTER INSERT OR UPDATE OR DELETE ON log_analyze_receipts
            FOR EACH ROW EXECUTE FUNCTION maintain_rule_hit_count()`)
        await query('UPDATE rule_hit_count_state SET initialized=TRUE WHERE id=TRUE')
    })
}
