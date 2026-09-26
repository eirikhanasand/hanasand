import run from '#db'

const renameEventStorageObjects = `
DO $migration$
DECLARE
    schema_name TEXT := current_schema();
    old_name TEXT;
    new_name TEXT;
    target_name TEXT;
    object_row RECORD;
BEGIN
    FOR object_row IN
        SELECT * FROM (VALUES
            ('mill_events','events'),
            ('mill_rules','rules'),
            ('mill_findings','findings'),
            ('mill_rule_reprocess_jobs','rule_reprocess_jobs'),
            ('mill_analysis_policy_migrations','analysis_policy_migrations'),
            ('mill_log_dimensions','log_dimensions'),
            ('mill_log_dimensions_state','log_dimensions_state'),
            ('mill_log_counts','log_counts'),
            ('mill_log_counts_state','log_counts_state')
        ) AS names(old_name,new_name)
    LOOP
        old_name := object_row.old_name;
        new_name := object_row.new_name;
        IF to_regclass(format('%I.%I',schema_name,old_name)) IS NOT NULL
            AND to_regclass(format('%I.%I',schema_name,new_name)) IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot rename %.% to %.% because both tables exist',schema_name,old_name,schema_name,new_name;
        ELSIF to_regclass(format('%I.%I',schema_name,old_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I.%I RENAME TO %I',schema_name,old_name,new_name);
        END IF;
    END LOOP;

    FOR object_row IN
        SELECT c.relname AS old_name
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=schema_name AND c.relkind='i' AND c.relname LIKE 'idx_mill_%'
    LOOP
        target_name := replace(object_row.old_name,'idx_mill_','idx_');
        IF to_regclass(format('%I.%I',schema_name,target_name)) IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot rename index %.% because the target already exists',schema_name,target_name;
        END IF;
        EXECUTE format('ALTER INDEX %I.%I RENAME TO %I',schema_name,object_row.old_name,target_name);
    END LOOP;

    FOR object_row IN
        SELECT s.stxname AS old_name
        FROM pg_statistic_ext s JOIN pg_namespace n ON n.oid=s.stxnamespace
        WHERE n.nspname=schema_name AND s.stxname LIKE 'stat_mill_%'
    LOOP
        target_name := replace(object_row.old_name,'stat_mill_','stat_');
        IF EXISTS (SELECT 1 FROM pg_statistic_ext s JOIN pg_namespace n ON n.oid=s.stxnamespace
            WHERE n.nspname=schema_name AND s.stxname=target_name) THEN
            RAISE EXCEPTION 'Cannot rename statistics %.% because the target already exists',schema_name,target_name;
        END IF;
        EXECUTE format('ALTER STATISTICS %I.%I RENAME TO %I',schema_name,object_row.old_name,target_name);
    END LOOP;

    FOR object_row IN
        SELECT t.tgname AS old_name, t.tgrelid::regclass AS table_name
        FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=schema_name AND NOT t.tgisinternal AND t.tgname LIKE 'mill_log_%'
    LOOP
        target_name := replace(object_row.old_name,'mill_','');
        IF EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid=object_row.table_name AND t.tgname=target_name) THEN
            RAISE EXCEPTION 'Cannot rename trigger % on % because the target already exists',object_row.old_name,object_row.table_name;
        END IF;
        EXECUTE format('ALTER TRIGGER %I ON %s RENAME TO %I',object_row.old_name,object_row.table_name,target_name);
    END LOOP;

    FOR object_row IN
        SELECT p.oid::regprocedure AS signature, p.proname AS old_name
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname=schema_name AND p.proname IN ('sync_mill_log_dimensions','sync_mill_log_counts')
    LOOP
        target_name := replace(object_row.old_name,'sync_mill_','sync_');
        IF to_regprocedure(format('%I.%s',schema_name,target_name || '()')) IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot rename function %.% because the target already exists',schema_name,target_name;
        END IF;
        EXECUTE format('ALTER FUNCTION %s RENAME TO %I',object_row.signature,target_name);
    END LOOP;

    FOR object_row IN
        SELECT con.conname AS old_name, con.conrelid::regclass AS table_name
        FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=schema_name AND con.conname LIKE 'mill_%'
    LOOP
        target_name := replace(object_row.old_name,'mill_','');
        IF EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conrelid=object_row.table_name AND con.conname=target_name) THEN
            RAISE EXCEPTION 'Cannot rename constraint % on % because the target already exists',object_row.old_name,object_row.table_name;
        END IF;
        EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',object_row.table_name,object_row.old_name,target_name);
    END LOOP;
END
$migration$`

export default async function ensureEventStorageNames(query: typeof run = run) {
    await query(renameEventStorageObjects)
}
