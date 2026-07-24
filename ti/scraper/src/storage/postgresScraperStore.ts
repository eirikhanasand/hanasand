import { SQL } from "bun";
import { fileURLToPath } from "node:url";
import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
  AnalystSourceActivationPacket,
  AnalystVictimNotificationPacket,
  CaptureReplayJob,
  CaptureWriteResult,
  CollectionPlan,
  CollectionRun,
  DiscoveryEvidence,
  DiscoveryPromotion,
  EvidenceDelta,
  IncidentCandidate,
  LiveSearchSnapshot,
  PipelineResult,
  RawCapture,
  SourceRecord
} from "../types.ts";
import { stableId } from "../utils.ts";
import type {
  EvaluationAdjudicationRecord,
  EvaluationAnnotationRecord,
  EvaluationBenchmarkRecord,
  EvaluationLabelRecord,
  EvaluationTaskRecord,
  EvaluationValidationRecord
} from "./evidenceStoreTypes.ts";
import { InMemoryScraperStore, linkedAlertCaptureIds } from "./memoryStore.ts";
import { persistActorIdentityCatalog } from "./postgresActorIdentityCatalog.ts";
import { isExecutableSource } from "../policy/collectionPolicy.ts";
import { canonicalFeedKey } from "../registry/sourceSeedUtils.ts";
import { SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION, SOURCE_AUTOMATIC_REVIEW_SCHEMA, automaticReviewModelVersion } from "../policy/sourceAutomaticReview.ts";

const DEFAULT_MIGRATIONS = [
  { version: "006_threat_intelligence_store", path: fileURLToPath(new URL("../../migrations/006_threat_intelligence_store.sql", import.meta.url)) },
  { version: "007_operational_intelligence_spine", path: fileURLToPath(new URL("../../migrations/007_operational_intelligence_spine.sql", import.meta.url)) },
  { version: "008_intelligence_claims", path: fileURLToPath(new URL("../../migrations/008_intelligence_claims.sql", import.meta.url)) },
  { version: "009_preserve_changed_capture_evidence", path: fileURLToPath(new URL("../../migrations/009_preserve_changed_capture_evidence.sql", import.meta.url)) },
  { version: "010_sync_capture_retention_class", path: fileURLToPath(new URL("../../migrations/010_sync_capture_retention_class.sql", import.meta.url)) },
  { version: "011_remove_misclassified_feed_actors", path: fileURLToPath(new URL("../../migrations/011_remove_misclassified_feed_actors.sql", import.meta.url)) },
  { version: "012_classify_evaluation_labels", path: fileURLToPath(new URL("../../migrations/012_classify_evaluation_labels.sql", import.meta.url)) },
  { version: "013_repair_reprocessing_timeliness", path: fileURLToPath(new URL("../../migrations/013_repair_reprocessing_timeliness.sql", import.meta.url)) },
  { version: "014_link_delivered_alert_timeliness", path: fileURLToPath(new URL("../../migrations/014_link_delivered_alert_timeliness.sql", import.meta.url)) },
  { version: "015_repair_reprocessing_collection_time", path: fileURLToPath(new URL("../../migrations/015_repair_reprocessing_collection_time.sql", import.meta.url)) },
  { version: "016_merge_duplicate_actor_profiles", path: fileURLToPath(new URL("../../migrations/016_merge_duplicate_actor_profiles.sql", import.meta.url)) },
  { version: "017_evidence_linked_timeliness", path: fileURLToPath(new URL("../../migrations/017_evidence_linked_timeliness.sql", import.meta.url)) },
  { version: "018_remove_unsupported_business_claims", path: fileURLToPath(new URL("../../migrations/018_remove_unsupported_business_claims.sql", import.meta.url)) },
  { version: "019_incident_logical_identity", path: fileURLToPath(new URL("../../migrations/019_incident_logical_identity.sql", import.meta.url)) },
  { version: "020_actor_identity_catalog", path: fileURLToPath(new URL("../../migrations/020_actor_identity_catalog.sql", import.meta.url)) },
  { version: "021_remove_dangling_incident_evidence_links", path: fileURLToPath(new URL("../../migrations/021_remove_dangling_incident_evidence_links.sql", import.meta.url)) },
  { version: "022_reconcile_source_fleet", path: fileURLToPath(new URL("../../migrations/022_reconcile_source_fleet.sql", import.meta.url)) },
  { version: "023_reconcile_delivery_and_event_times", path: fileURLToPath(new URL("../../migrations/023_reconcile_delivery_and_event_times.sql", import.meta.url)) },
  { version: "024_finish_timestamp_backfill", path: fileURLToPath(new URL("../../migrations/024_finish_timestamp_backfill.sql", import.meta.url)) },
  { version: "025_reconcile_timeliness_capture", path: fileURLToPath(new URL("../../migrations/025_reconcile_timeliness_capture.sql", import.meta.url)) },
  { version: "026_align_timeliness_capture_record", path: fileURLToPath(new URL("../../migrations/026_align_timeliness_capture_record.sql", import.meta.url)) },
  { version: "027_reconcile_delivery_latencies", path: fileURLToPath(new URL("../../migrations/027_reconcile_delivery_latencies.sql", import.meta.url)) },
  { version: "028_remove_generic_business_labels", path: fileURLToPath(new URL("../../migrations/028_remove_generic_business_labels.sql", import.meta.url)) },
  { version: "029_scope_capture_dedupe_by_tenant", path: fileURLToPath(new URL("../../migrations/029_scope_capture_dedupe_by_tenant.sql", import.meta.url)) },
  { version: "030_reconcile_actor_profiles", path: fileURLToPath(new URL("../../migrations/030_reconcile_actor_profiles.sql", import.meta.url)) },
  { version: "031_archive_inactive_actor_profiles", path: fileURLToPath(new URL("../../migrations/031_archive_inactive_actor_profiles.sql", import.meta.url)) },
  { version: "032_reconcile_actor_profile_scope_lineage", path: fileURLToPath(new URL("../../migrations/032_reconcile_actor_profile_scope_lineage.sql", import.meta.url)) },
  { version: "033_bound_source_operations", path: fileURLToPath(new URL("../../migrations/033_bound_source_operations.sql", import.meta.url)) },
  { version: "034_reconcile_incomplete_collection_runs", path: fileURLToPath(new URL("../../migrations/034_reconcile_incomplete_collection_runs.sql", import.meta.url)) },
  { version: "035_preserve_unknown_delivery_completion", path: fileURLToPath(new URL("../../migrations/035_preserve_unknown_delivery_completion.sql", import.meta.url)) }
] as const;
const LATEST_MIGRATION_VERSION = DEFAULT_MIGRATIONS.at(-1)!.version;

export type PostgresScraperStoreOptions = {
  databaseUrl?: string;
  migrationPath?: string;
};

type PendingWrite = { description: string; run: () => Promise<void> };
type Migration = { version: string; path: string };
type DatabaseHealth = {
  ok: boolean;
  backend: "postgresql";
  schema: "threat_intel";
  migrationVersion: string;
  actorProfileScopeReady?: boolean;
  pendingWrites: number;
  lastWriteError?: string;
};

export class PostgresScraperStore extends InMemoryScraperStore {
  private readonly sql: SQL;
  private readonly migrations: Migration[];
  private readonly pendingWrites: PendingWrite[] = [];
  private draining?: Promise<void>;
  private lastWriteError?: Error;
  private lastDatabaseHealth?: DatabaseHealth;
  private databaseHealthCheckedAt = 0;
  private databaseHealthRefresh?: Promise<void>;
  private pipelineDepth = 0;

  private constructor(sql: SQL, migrations: Migration[]) {
    super();
    this.sql = sql;
    this.migrations = migrations;
  }

  static async create(options: PostgresScraperStoreOptions = {}): Promise<PostgresScraperStore> {
    const databaseUrl = options.databaseUrl ?? Bun.env.TI_DATABASE_URL;
    const sql = databaseUrl ? new SQL(databaseUrl) : new SQL();
    const migrations = DEFAULT_MIGRATIONS.map((migration, index) => ({
      ...migration,
      path: index === 0 && options.migrationPath ? options.migrationPath : migration.path
    }));
    const store = new PostgresScraperStore(sql, migrations);
    try {
      await sql.connect();
      await store.migrate();
      await store.hydrate();
      await store.backfillSourceOperationalKeys();
      await store.databaseHealth();
      return store;
    } catch (error) {
      await sql.close({ timeout: 1 }).catch(() => undefined);
      throw error;
    }
  }

  async batch<T>(write: () => T | Promise<T>): Promise<T> {
    const value = await write();
    await this.flush();
    return value;
  }

  async flush(): Promise<void> {
    if (this.draining) await this.draining;
    if (this.pendingWrites.length) {
      this.lastWriteError = undefined;
      this.startDrain();
      if (this.draining) await this.draining;
    }
    if (this.pendingWrites.length) {
      throw new Error(`Threat-intelligence database write failed (${this.pendingWrites[0].description}): ${this.lastWriteError?.message ?? "unknown database error"}`);
    }
  }

  async close(): Promise<void> {
    await this.flush();
    await this.sql.close({ timeout: 5 });
  }

  async databaseHealth(): Promise<DatabaseHealth> {
    let health: DatabaseHealth;
    try {
      const [row] = await this.sql<{ schema_ready: boolean; migration_ready: boolean; actor_profile_scope_ready: boolean }[]>`
        SELECT
          to_regnamespace('threat_intel') IS NOT NULL AS schema_ready,
          EXISTS (
            SELECT 1
            FROM threat_intel.schema_migrations
            WHERE version = ${LATEST_MIGRATION_VERSION}
          ) AS migration_ready,
          NOT EXISTS (
            SELECT 1
            FROM threat_intel.actor_profiles profile
            CROSS JOIN LATERAL jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(profile.record->'captureIds') = 'array' THEN profile.record->'captureIds' ELSE '[]'::jsonb END
            ) capture_id
            JOIN threat_intel.captures capture ON capture.id = capture_id
            WHERE COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived'
              AND profile.tenant_id IS DISTINCT FROM capture.tenant_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM threat_intel.actor_aliases alias
            JOIN threat_intel.actor_profiles profile ON profile.id = alias.actor_profile_id
            WHERE alias.tenant_id IS DISTINCT FROM profile.tenant_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM threat_intel.evidence_links link
            JOIN threat_intel.captures capture ON capture.id = link.capture_id
            LEFT JOIN threat_intel.actor_profiles profile ON profile.id = link.subject_id
            WHERE link.subject_type = 'actor_profile'
              AND (profile.id IS NULL OR profile.tenant_id IS DISTINCT FROM capture.tenant_id)
          )
          AND NOT EXISTS (
            SELECT 1
            FROM threat_intel.workflow_records workflow
            WHERE workflow.record->>'subjectType' = 'actor_profile'
              AND NULLIF(workflow.record->>'subjectId', '') IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM threat_intel.actor_profiles profile
                WHERE profile.id = workflow.record->>'subjectId'
                  AND profile.tenant_id IS NOT DISTINCT FROM workflow.tenant_id
                  AND COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM threat_intel.actor_profile_scope_lineage lineage
                LEFT JOIN threat_intel.actor_profiles target ON target.id = lineage.target_actor_profile_id
                WHERE lineage.source_actor_profile_id = workflow.record->>'subjectId'
                  AND lineage.scope_key = CASE WHEN workflow.tenant_id IS NULL THEN 'global' ELSE 'tenant:' || md5(workflow.tenant_id) END
                  AND (lineage.target_actor_profile_id IS NULL OR target.tenant_id IS NOT DISTINCT FROM workflow.tenant_id)
              )
          ) AS actor_profile_scope_ready
      `;
      health = {
        ok: Boolean(row?.schema_ready && row?.migration_ready && row?.actor_profile_scope_ready),
        backend: "postgresql",
        schema: "threat_intel",
        migrationVersion: LATEST_MIGRATION_VERSION,
        actorProfileScopeReady: Boolean(row?.actor_profile_scope_ready),
        pendingWrites: this.pendingWrites.length,
        lastWriteError: this.lastWriteError?.message
      };
    } catch (error) {
      health = {
        ok: false,
        backend: "postgresql",
        schema: "threat_intel",
        migrationVersion: LATEST_MIGRATION_VERSION,
        pendingWrites: this.pendingWrites.length,
        lastWriteError: error instanceof Error ? error.message : String(error)
      };
    }
    this.lastDatabaseHealth = health;
    this.databaseHealthCheckedAt = Date.now();
    return health;
  }

  databaseHealthSnapshot(): DatabaseHealth {
    if (!this.databaseHealthRefresh && Date.now() - this.databaseHealthCheckedAt >= 30_000) {
      this.databaseHealthRefresh = this.databaseHealth()
        .then(() => undefined)
        .finally(() => { this.databaseHealthRefresh = undefined; });
    }
    const health = this.lastDatabaseHealth ?? {
      ok: !this.lastWriteError,
      backend: "postgresql" as const,
      schema: "threat_intel" as const,
      migrationVersion: LATEST_MIGRATION_VERSION,
      pendingWrites: this.pendingWrites.length
    };
    return {
      ...health,
      ok: health.ok && !this.lastWriteError,
      pendingWrites: this.pendingWrites.length,
      lastWriteError: this.lastWriteError?.message ?? health.lastWriteError
    };
  }

  async queryStructuredRecords(collection: keyof typeof structuredTables, input: { tenantId?: string; query?: string; limit?: number; offset?: number } = {}) {
    const table = structuredTables[collection];
    if (!table) throw new Error(`Unsupported threat-intelligence collection: ${collection}`);
    const limit = Math.max(1, Math.min(500, Number(input.limit ?? 50)));
    const offset = Math.max(0, Number(input.offset ?? 0));
    const parameters = [input.tenantId ?? null, input.query?.trim().toLowerCase() || null];
    const searchBy = "searchBy" in table ? table.searchBy : "record::text";
    const tenantWhere = "includeGlobal" in table && table.includeGlobal
      ? `($1::text IS NULL AND tenant_id IS NULL OR $1::text IS NOT NULL AND (tenant_id IS NULL OR tenant_id IS NOT DISTINCT FROM $1::text))`
      : `(tenant_id IS NOT DISTINCT FROM $1::text)`;
    const collectionWhere = "where" in table ? table.where : "TRUE";
    const where = `${tenantWhere} AND (${collectionWhere}) AND ($2::text IS NULL OR position($2 in lower(${searchBy})) > 0)`;
    const [rows, countRows] = await Promise.all([
      this.sql.unsafe(`SELECT record FROM threat_intel.${table.name} WHERE ${where} ORDER BY ${table.orderBy} DESC LIMIT $3 OFFSET $4`, [...parameters, limit, offset]),
      this.sql.unsafe(`SELECT count(*)::int AS total FROM threat_intel.${table.name} WHERE ${where}`, parameters)
    ]);
    const total = Number(countRows[0]?.total ?? 0);
    const records = rows.map(readRecord);
    return { records, total, nextCursor: offset + records.length < total ? String(offset + records.length) : undefined };
  }

  async querySourceOperationalPage(input: { tenantId?: string; generatedAt: string; limit?: number; offset?: number; sourceId?: string; executableOnly?: boolean } ) {
    const limit = Math.max(1, Math.min(500, Number(input.limit ?? 100)));
    const offset = Math.max(0, Number(input.offset ?? 0));
    const tenantId = input.tenantId ?? null;
    const sourceId = input.sourceId?.trim() || null;
    const executableOnly = input.executableOnly === true;
    const [rows, totalRows] = await Promise.all([
      this.sql.unsafe(`
        WITH page AS (
          SELECT source.*
          FROM threat_intel.sources source
          WHERE source.tenant_id IS NOT DISTINCT FROM $1::text
            AND ($2::text IS NULL OR source.id = $2::text)
            AND (NOT $3::boolean OR source.collection_executable)
          ORDER BY lower(source.name), source.id
          LIMIT $4 OFFSET $5
        )
        SELECT page.record,
          page.collection_executable,
          canonical_owner.id AS canonical_owner_id,
          ${sourceReviewEvidenceMatchesSql("page")} AS automatic_review_evidence_matches,
          health.stats AS health_stats,
          captures.stats AS capture_stats,
          actors.stats AS actor_stats,
          labels.stats AS label_stats
        FROM page
        LEFT JOIN LATERAL (
          SELECT candidate.id
          FROM threat_intel.sources candidate
          LEFT JOIN LATERAL (
            SELECT count(*) AS capture_count
            FROM threat_intel.captures candidate_capture
            WHERE candidate_capture.source_id = candidate.id
              AND candidate_capture.tenant_id IS NOT DISTINCT FROM candidate.tenant_id
          ) candidate_captures ON TRUE
          WHERE candidate.tenant_id IS NOT DISTINCT FROM page.tenant_id
            AND candidate.collection_executable
            AND (page.canonical_feed_key IS NULL AND candidate.id = page.id
              OR page.canonical_feed_key IS NOT NULL AND candidate.canonical_feed_key = page.canonical_feed_key)
          ORDER BY candidate_captures.capture_count DESC,
            COALESCE(candidate.record->>'createdAt', ''),
            candidate.id
          LIMIT 1
        ) canonical_owner ON TRUE
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
            'observationCount', count(*),
            'scheduledCycleCount', count(DISTINCT h.collection_run_id) FILTER (
              WHERE h.collection_run_id IS NOT NULL
                AND h.checked_at >= $6::timestamptz - make_interval(secs => GREATEST(
                  86400,
                  COALESCE((page.record->>'crawlFrequencySeconds')::int, 86400) * 3,
                  COALESCE((page.record->'metadata'->>'activityWindowSeconds')::int, 2592000)
                ))
            ),
            'successCount', count(*) FILTER (WHERE h.success),
            'usefulCycleCount', count(DISTINCT h.collection_run_id) FILTER (
              WHERE h.collection_run_id IS NOT NULL AND h.success AND h.useful AND h.capture_count > 0
                AND h.checked_at >= $6::timestamptz - make_interval(secs => GREATEST(
                  86400,
                  COALESCE((page.record->>'crawlFrequencySeconds')::int, 86400) * 3,
                  COALESCE((page.record->'metadata'->>'activityWindowSeconds')::int, 2592000)
                ))
                AND EXISTS (
                  SELECT 1 FROM threat_intel.captures retained
                  WHERE retained.source_id = page.id
                    AND retained.tenant_id IS NOT DISTINCT FROM page.tenant_id
                    AND retained.record->'metadata'->>'runId' = h.collection_run_id
                )
            ),
            'successfulCycleCount', count(DISTINCT h.collection_run_id) FILTER (
              WHERE h.collection_run_id IS NOT NULL AND h.success
                AND h.checked_at >= $6::timestamptz - make_interval(secs => GREATEST(
                  86400,
                  COALESCE((page.record->>'crawlFrequencySeconds')::int, 86400) * 3,
                  COALESCE((page.record->'metadata'->>'activityWindowSeconds')::int, 2592000)
                ))
            ),
            'parserAttemptCount', count(*) FILTER (WHERE h.success),
            'parserSuccessCount', count(*) FILTER (WHERE h.success AND h.parser_warning_count = 0),
            'parserWarningCount', COALESCE(sum(h.parser_warning_count), 0),
            'duplicateCount', COALESCE(sum(h.duplicate_count), 0),
            'reportedCaptureCount', COALESCE(sum(h.capture_count), 0),
            'observedFalsePositiveRate', avg(h.false_positive_rate),
            'latest', (array_agg(h.record ORDER BY h.checked_at DESC))[1],
            'lastSuccessAt', max(h.checked_at) FILTER (WHERE h.success),
            'lastUsefulAt', max(h.checked_at) FILTER (
              WHERE h.success AND h.useful AND h.capture_count > 0
                AND EXISTS (
                  SELECT 1 FROM threat_intel.captures retained
                  WHERE retained.source_id = page.id
                    AND retained.tenant_id IS NOT DISTINCT FROM page.tenant_id
                    AND retained.record->'metadata'->>'runId' = h.collection_run_id
                )
            ),
            'latestUseful', COALESCE((
              SELECT bool_or(latest_observation.success AND latest_observation.useful AND latest_observation.capture_count > 0)
              FROM threat_intel.source_health latest_observation
              WHERE latest_observation.source_id = page.id
                AND latest_observation.tenant_id IS NOT DISTINCT FROM page.tenant_id
                AND latest_observation.checked_at >= $6::timestamptz - make_interval(secs => GREATEST(
                  86400,
                  COALESCE((page.record->>'crawlFrequencySeconds')::int, 86400) * 3,
                  COALESCE((page.record->'metadata'->>'activityWindowSeconds')::int, 2592000)
                ))
                AND latest_observation.collection_run_id = (
                  SELECT latest_run.collection_run_id
                  FROM threat_intel.source_health latest_run
                  WHERE latest_run.source_id = page.id
                    AND latest_run.tenant_id IS NOT DISTINCT FROM page.tenant_id
                    AND latest_run.collection_run_id IS NOT NULL
                    AND latest_run.checked_at >= $6::timestamptz - make_interval(secs => GREATEST(
                      86400,
                      COALESCE((page.record->>'crawlFrequencySeconds')::int, 86400) * 3,
                      COALESCE((page.record->'metadata'->>'activityWindowSeconds')::int, 2592000)
                    ))
                  ORDER BY latest_run.checked_at DESC, latest_run.id DESC
                  LIMIT 1
                )
                AND EXISTS (
                  SELECT 1 FROM threat_intel.captures retained
                  WHERE retained.source_id = page.id
                    AND retained.tenant_id IS NOT DISTINCT FROM page.tenant_id
                    AND retained.record->'metadata'->>'runId' = latest_observation.collection_run_id
                )
            ), FALSE),
            'lastFailure', (array_agg(h.record ORDER BY h.checked_at DESC) FILTER (WHERE NOT h.success))[1]
          ) AS stats
          FROM threat_intel.source_health h
          WHERE h.source_id = page.id AND h.tenant_id IS NOT DISTINCT FROM page.tenant_id
        ) health ON TRUE
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
            'captureCount', count(*),
            'lastContentAt', max(COALESCE(c.published_at, c.collected_at)),
            'lastExtractorVersion', (array_agg(c.extractor_version ORDER BY c.collected_at DESC))[1],
            'observedDomains', COALESCE(jsonb_agg(DISTINCT lower(c.record->'metadata'->>'domain')) FILTER (WHERE c.record->'metadata'->>'domain' IS NOT NULL), '[]'::jsonb),
            'resultTypes', COALESCE(jsonb_agg(DISTINCT COALESCE(c.record->'metadata'->>'pageType', c.record->'metadata'->>'kind', c.media_type)), '[]'::jsonb)
          ) AS stats
          FROM threat_intel.captures c
          WHERE c.source_id = page.id AND c.tenant_id IS NOT DISTINCT FROM page.tenant_id
        ) captures ON TRUE
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
            'count', count(DISTINCT e.normalized_value),
            'values', COALESCE(jsonb_agg(DISTINCT e.normalized_value), '[]'::jsonb)
          ) AS stats
          FROM threat_intel.entities e
          WHERE e.source_id = page.id AND e.tenant_id IS NOT DISTINCT FROM page.tenant_id
            AND e.entity_type IN ('actor', 'ransomware_family')
        ) actors ON TRUE
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
            'classified', count(*) FILTER (WHERE l.outcome IN ('true_positive', 'false_positive')),
            'falsePositive', count(*) FILTER (WHERE l.outcome = 'false_positive')
          ) AS stats
          FROM threat_intel.evaluation_labels l
          LEFT JOIN threat_intel.captures lc ON lc.id = l.capture_id
          LEFT JOIN threat_intel.entities le ON le.id = l.entity_id
          LEFT JOIN threat_intel.indicators li ON li.id = l.indicator_id
          LEFT JOIN threat_intel.incidents ln ON ln.id = l.incident_id
          LEFT JOIN threat_intel.claim_evidence ce ON ce.claim_id = l.claim_id
          LEFT JOIN threat_intel.captures cc ON cc.id = ce.capture_id
          WHERE l.tenant_id IS NOT DISTINCT FROM page.tenant_id
            AND COALESCE(lc.source_id, le.source_id, li.source_id, ln.source_id, cc.source_id) = page.id
        ) labels ON TRUE
        ORDER BY lower(page.name), page.id
      `, [tenantId, sourceId, executableOnly, limit, offset, input.generatedAt]),
      this.sql.unsafe(`
        WITH capture_counts AS (
          SELECT source_id, tenant_id, count(*) AS capture_count
          FROM threat_intel.captures
          WHERE tenant_id IS NOT DISTINCT FROM $1::text
          GROUP BY source_id, tenant_id
        ), canonical_sources AS (
          SELECT source.*,
            row_number() OVER (
              PARTITION BY COALESCE(source.canonical_feed_key, 'source:' || source.id)
              ORDER BY source.collection_executable DESC,
                COALESCE(capture_counts.capture_count, 0) DESC,
                COALESCE(source.record->>'createdAt', ''),
                source.id
            ) AS canonical_rank
          FROM threat_intel.sources source
          LEFT JOIN capture_counts
            ON capture_counts.source_id = source.id
            AND capture_counts.tenant_id IS NOT DISTINCT FROM source.tenant_id
          WHERE source.tenant_id IS NOT DISTINCT FROM $1::text
        ), scoped AS (
          SELECT * FROM canonical_sources
          WHERE ($2::text IS NULL OR id = $2::text)
            AND (NOT $3::boolean OR collection_executable)
        ), per_source AS (
          SELECT source.id, source.tenant_id, source.status, source.source_type, source.collection_executable,
            source.canonical_feed_key, source.canonical_rank, source.record,
            health.observation_count, health.last_checked_at, health.last_success_at,
            health.last_useful_at, health.successful_cycles, health.useful_cycles,
            health.latest_success, health.latest_useful, health.latest_status, health.latest_parser_warning_count,
            captures.capture_count, captures.last_content_at
          FROM scoped source
          CROSS JOIN LATERAL (
            SELECT count(*) AS observation_count,
              max(checked_at) AS last_checked_at,
              max(checked_at) FILTER (WHERE success) AS last_success_at,
              max(checked_at) FILTER (
                WHERE success AND useful AND capture_count > 0
                  AND EXISTS (
                    SELECT 1 FROM threat_intel.captures retained
                    WHERE retained.source_id = source.id
                      AND retained.tenant_id IS NOT DISTINCT FROM source.tenant_id
                      AND retained.record->'metadata'->>'runId' = source_health.collection_run_id
                  )
              ) AS last_useful_at,
              (array_agg(success ORDER BY checked_at DESC))[1] AS latest_success,
              COALESCE((
                SELECT bool_or(latest_observation.success AND latest_observation.useful AND latest_observation.capture_count > 0)
                FROM threat_intel.source_health latest_observation
                WHERE latest_observation.source_id = source.id
                  AND latest_observation.tenant_id IS NOT DISTINCT FROM source.tenant_id
                  AND latest_observation.checked_at >= $4::timestamptz - make_interval(secs => GREATEST(
                    86400,
                    COALESCE((source.record->>'crawlFrequencySeconds')::int, 86400) * 3,
                    COALESCE((source.record->'metadata'->>'activityWindowSeconds')::int, 2592000)
                  ))
                  AND latest_observation.collection_run_id = (
                    SELECT latest_run.collection_run_id
                    FROM threat_intel.source_health latest_run
                    WHERE latest_run.source_id = source.id
                      AND latest_run.tenant_id IS NOT DISTINCT FROM source.tenant_id
                      AND latest_run.collection_run_id IS NOT NULL
                      AND latest_run.checked_at >= $4::timestamptz - make_interval(secs => GREATEST(
                        86400,
                        COALESCE((source.record->>'crawlFrequencySeconds')::int, 86400) * 3,
                        COALESCE((source.record->'metadata'->>'activityWindowSeconds')::int, 2592000)
                      ))
                    ORDER BY latest_run.checked_at DESC, latest_run.id DESC
                    LIMIT 1
                  )
                  AND EXISTS (
                    SELECT 1 FROM threat_intel.captures retained
                    WHERE retained.source_id = source.id
                      AND retained.tenant_id IS NOT DISTINCT FROM source.tenant_id
                      AND retained.record->'metadata'->>'runId' = latest_observation.collection_run_id
                  )
              ), FALSE) AS latest_useful,
              (array_agg(status ORDER BY checked_at DESC))[1] AS latest_status,
              (array_agg(parser_warning_count ORDER BY checked_at DESC))[1] AS latest_parser_warning_count,
              count(DISTINCT collection_run_id) FILTER (
                WHERE collection_run_id IS NOT NULL AND success
                  AND checked_at >= $4::timestamptz - make_interval(secs => GREATEST(
                    86400,
                    COALESCE((source.record->>'crawlFrequencySeconds')::int, 86400) * 3,
                    COALESCE((source.record->'metadata'->>'activityWindowSeconds')::int, 2592000)
                  ))
              ) AS successful_cycles,
              count(DISTINCT collection_run_id) FILTER (
                WHERE collection_run_id IS NOT NULL AND success AND useful AND capture_count > 0
                  AND checked_at >= $4::timestamptz - make_interval(secs => GREATEST(
                    86400,
                    COALESCE((source.record->>'crawlFrequencySeconds')::int, 86400) * 3,
                    COALESCE((source.record->'metadata'->>'activityWindowSeconds')::int, 2592000)
                  ))
                  AND EXISTS (
                    SELECT 1 FROM threat_intel.captures retained
                    WHERE retained.source_id = source.id
                      AND retained.tenant_id IS NOT DISTINCT FROM source.tenant_id
                      AND retained.record->'metadata'->>'runId' = source_health.collection_run_id
                  )
              ) AS useful_cycles
            FROM threat_intel.source_health
            WHERE source_id = source.id AND tenant_id IS NOT DISTINCT FROM source.tenant_id
          ) health
          CROSS JOIN LATERAL (
            SELECT count(*) AS capture_count,
              max(COALESCE(published_at, collected_at)) AS last_content_at
            FROM threat_intel.captures
            WHERE source_id = source.id AND tenant_id IS NOT DISTINCT FROM source.tenant_id
          ) captures
        ), ranked AS (
          SELECT per_source.*,
            collection_executable
              AND btrim(COALESCE(record->>'legalNotes', '')) <> ''
              AND successful_cycles >= 2
              AND useful_cycles >= 2
              AND capture_count > 0
              AND (
                (record->'metadata'->'sourcePortfolioVerification' IS NULL AND record->'metadata'->'sourceFeedDiscovery' IS NULL)
                OR (
                  record->'metadata'->'automaticSourceReview'->>'schemaVersion' = '${SOURCE_AUTOMATIC_REVIEW_SCHEMA}'
                  AND record->'metadata'->'automaticSourceReview'->>'state' = 'approved'
                  AND record->'metadata'->'automaticSourceReview'->>'promptVersion' = '${SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION}'
                  AND record->'metadata'->'automaticSourceReview'->>'configuredModelVersion' = $5::text
                  AND record->'metadata'->'automaticSourceReview'->'sourceIdentity'->>'sourceId' = id
                  AND record->'metadata'->'automaticSourceReview'->'sourceIdentity'->>'tenantKey' = COALESCE(tenant_id, 'global')
                  AND record->'metadata'->'automaticSourceReview'->'sourceIdentity'->>'canonicalFeedKey' = COALESCE(canonical_feed_key, '')
                  AND record->'metadata'->'automaticSourceReview'->'sourceIdentity'->>'createdAt' = COALESCE(record->>'createdAt', '')
                  AND record->'metadata'->'automaticSourceReview'->'sourceIdentity'->>'sha256' = encode(sha256(convert_to(
                    '{"sourceId":' || to_json(id)::text
                    || ',"tenantKey":' || to_json(COALESCE(tenant_id, 'global'))::text
                    || ',"canonicalFeedKey":' || to_json(COALESCE(canonical_feed_key, ''))::text
                    || ',"createdAt":' || to_json(COALESCE(record->>'createdAt', ''))::text
                    || '}',
                    'UTF8'
                  )), 'hex')
                  AND record->'metadata'->'automaticSourceReview'->'decision'->'subject'->>'type' = 'source'
                  AND record->'metadata'->'automaticSourceReview'->'decision'->'subject'->>'id' = id
                  AND record->'metadata'->'automaticSourceReview'->'decision'->>'action' = 'confirm'
                  AND record->'metadata'->'automaticSourceReview'->'decision'->>'claimValidity' = 'supported'
                  AND record->'metadata'->'automaticSourceReview'->'runtimeIdentity'->>'status' = 'completed'
                  AND COALESCE(record->'metadata'->'automaticSourceReview'->'runtimeIdentity'->>'conversationId', '') <> ''
                  AND COALESCE(record->'metadata'->'automaticSourceReview'->>'requestSha256', '') ~ '^[a-f0-9]{64}$'
                  AND jsonb_typeof(record->'metadata'->'automaticSourceReview'->'selectedEvidenceIds') = 'array'
                  AND jsonb_array_length(record->'metadata'->'automaticSourceReview'->'selectedEvidenceIds') > 0
                  AND jsonb_typeof(record->'metadata'->'automaticSourceReview'->'selectedEvidenceProvenance') = 'array'
                  AND jsonb_array_length(record->'metadata'->'automaticSourceReview'->'selectedEvidenceProvenance')
                    = jsonb_array_length(record->'metadata'->'automaticSourceReview'->'selectedEvidenceIds')
                  AND (
                    SELECT count(DISTINCT selected_id)
                    FROM jsonb_array_elements_text(record->'metadata'->'automaticSourceReview'->'selectedEvidenceIds') selected_id
                  ) = jsonb_array_length(record->'metadata'->'automaticSourceReview'->'selectedEvidenceIds')
                  AND (
                    SELECT count(DISTINCT binding->>'evidenceId')
                    FROM jsonb_array_elements(record->'metadata'->'automaticSourceReview'->'selectedEvidenceProvenance') binding
                  ) = jsonb_array_length(record->'metadata'->'automaticSourceReview'->'selectedEvidenceProvenance')
                  AND COALESCE((record->>'countsAsCoverage')::boolean, FALSE)
                  AND COALESCE((record->'metadata'->>'productionCollection')::boolean, FALSE)
                  AND NOT EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(record->'metadata'->'automaticSourceReview'->'selectedEvidenceProvenance') binding
                    WHERE COALESCE(binding->>'evidenceId', '') !~ '^[A-Za-z0-9_.:-]{1,200}$'
                      OR COALESCE(binding->>'sourceId', '') <> per_source.id
                      OR COALESCE(binding->>'tenantKey', '') <> COALESCE(per_source.tenant_id, 'global')
                      OR COALESCE(binding->>'captureId', '') !~ '^[A-Za-z0-9_.:-]{1,200}$'
                      OR COALESCE(binding->>'contentHash', '') !~ '^[A-Za-z0-9_.:-]{1,200}$'
                      OR COALESCE(binding->>'captureStateSha256', '') !~ '^[a-f0-9]{64}$'
                      OR binding->>'evidenceId' <> 'automatic-source-review-evidence_' || substr(encode(sha256(convert_to(binding->>'captureId', 'UTF8')), 'hex'), 1, 16)
                      OR NOT (record->'metadata'->'automaticSourceReview'->'selectedEvidenceIds' ? (binding->>'evidenceId'))
                      OR NOT EXISTS (
                        SELECT 1
                        FROM threat_intel.captures bound_capture
                        WHERE bound_capture.id = binding->>'captureId'
                          AND bound_capture.source_id = per_source.id
                          AND bound_capture.tenant_id IS NOT DISTINCT FROM per_source.tenant_id
                          AND bound_capture.content_hash = binding->>'contentHash'
                          AND binding->>'captureStateSha256' = encode(sha256(convert_to(concat_ws('|',
                            octet_length(COALESCE(bound_capture.record->>'sourceId', ''))::text || ':' || COALESCE(bound_capture.record->>'sourceId', ''),
                            octet_length(COALESCE(bound_capture.record->>'tenantId', 'global'))::text || ':' || COALESCE(bound_capture.record->>'tenantId', 'global'),
                            octet_length(COALESCE(bound_capture.record->>'contentHash', ''))::text || ':' || COALESCE(bound_capture.record->>'contentHash', ''),
                            octet_length(COALESCE(bound_capture.record->>'body', ''))::text || ':' || COALESCE(bound_capture.record->>'body', ''),
                            octet_length(COALESCE(bound_capture.record->>'sensitive', ''))::text || ':' || COALESCE(bound_capture.record->>'sensitive', ''),
                            octet_length(COALESCE(bound_capture.record->>'publishedAt', ''))::text || ':' || COALESCE(bound_capture.record->>'publishedAt', ''),
                            octet_length(COALESCE(bound_capture.record->>'collectedAt', ''))::text || ':' || COALESCE(bound_capture.record->>'collectedAt', ''),
                            octet_length(COALESCE(bound_capture.record->>'storageKind', ''))::text || ':' || COALESCE(bound_capture.record->>'storageKind', ''),
                            octet_length(COALESCE(bound_capture.record#>>'{provenance,extractorVersion}', bound_capture.record->>'extractorVersion', ''))::text || ':' || COALESCE(bound_capture.record#>>'{provenance,extractorVersion}', bound_capture.record->>'extractorVersion', ''),
                            octet_length(COALESCE(bound_capture.record#>>'{metadata,safeExcerpt}', ''))::text || ':' || COALESCE(bound_capture.record#>>'{metadata,safeExcerpt}', ''),
                            octet_length(COALESCE(bound_capture.record#>>'{metadata,leakSite,summary}', ''))::text || ':' || COALESCE(bound_capture.record#>>'{metadata,leakSite,summary}', ''),
                            octet_length(COALESCE(bound_capture.record#>>'{metadata,title}', ''))::text || ':' || COALESCE(bound_capture.record#>>'{metadata,title}', ''),
                            octet_length(COALESCE(bound_capture.record#>>'{provenance,parserVersion}', bound_capture.record#>>'{metadata,parserVersion}', ''))::text || ':' || COALESCE(bound_capture.record#>>'{provenance,parserVersion}', bound_capture.record#>>'{metadata,parserVersion}', '')
                          ), 'UTF8')), 'hex')
                      )
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(record->'metadata'->'automaticSourceReview'->'selectedEvidenceIds') selected_id
                    WHERE NOT EXISTS (
                      SELECT 1
                      FROM jsonb_array_elements(record->'metadata'->'automaticSourceReview'->'selectedEvidenceProvenance') binding
                      WHERE binding->>'evidenceId' = selected_id
                    )
                  )
                )
              )
              AND last_checked_at >= $4::timestamptz - make_interval(secs => GREATEST(86400, COALESCE((record->>'crawlFrequencySeconds')::int, 86400) * 3))
              AND last_useful_at >= $4::timestamptz - make_interval(secs => GREATEST(
                86400,
                COALESCE((record->>'crawlFrequencySeconds')::int, 86400) * 3,
                COALESCE((record->'metadata'->>'activityWindowSeconds')::int, 2592000)
              ))
              AND last_content_at >= $4::timestamptz - make_interval(secs => GREATEST(
                86400,
                COALESCE((record->>'crawlFrequencySeconds')::int, 86400) * 3,
                COALESCE((record->'metadata'->>'activityWindowSeconds')::int, 2592000)
              ))
              AS runtime_qualifies
          FROM per_source
        ), latest_run AS (
          SELECT record
          FROM threat_intel.collection_runs
          WHERE tenant_id IS NOT DISTINCT FROM $1::text AND request_id = 'req_public_canary'
          ORDER BY updated_at DESC LIMIT 1
        ), successful_run AS (
          SELECT record
          FROM threat_intel.collection_runs
          WHERE tenant_id IS NOT DISTINCT FROM $1::text AND request_id = 'req_public_canary'
            AND status IN ('completed', 'degraded')
          ORDER BY updated_at DESC LIMIT 1
        )
        SELECT jsonb_build_object(
          'sourceCount', count(*),
          'retainedSourceCount', count(*) FILTER (WHERE collection_executable),
          'inactiveSourceCount', count(*) FILTER (WHERE NOT collection_executable),
          'retiredSourceCount', count(*) FILTER (WHERE status = 'retired'),
          'activeSourceCount', count(*) FILTER (WHERE collection_executable),
          'observedSourceCount', count(*) FILTER (WHERE collection_executable AND observation_count > 0),
          'checkedSourceCount', count(*) FILTER (WHERE collection_executable AND observation_count > 0),
          'successfulSourceCount', count(*) FILTER (WHERE collection_executable AND last_success_at IS NOT NULL),
          'everUsefulSourceCount', count(*) FILTER (WHERE collection_executable AND last_useful_at IS NOT NULL),
          'usefulSourceCount', count(*) FILTER (WHERE collection_executable AND latest_useful),
          'latestUsefulSourceCount', count(*) FILTER (WHERE collection_executable AND latest_useful),
          'sustainedUsefulSourceCount', count(*) FILTER (WHERE collection_executable AND useful_cycles >= 2 AND capture_count > 0),
          'checkedWithin24hSourceCount', count(*) FILTER (WHERE collection_executable AND last_checked_at >= $4::timestamptz - interval '24 hours'),
          'successfulWithin24hSourceCount', count(*) FILTER (WHERE collection_executable AND last_success_at >= $4::timestamptz - interval '24 hours'),
          'usefulWithin24hSourceCount', count(*) FILTER (WHERE collection_executable AND last_useful_at >= $4::timestamptz - interval '24 hours'),
          'captureProducingSourceCount', count(*) FILTER (WHERE collection_executable AND capture_count > 0),
          'recentlySeenSourceCount', count(*) FILTER (WHERE collection_executable AND last_content_at >= $4::timestamptz - interval '24 hours'),
          'backoffSourceCount', count(*) FILTER (WHERE collection_executable AND COALESCE(record->'crawlState'->>'backoffUntil', '') <> '' AND (record->'crawlState'->>'backoffUntil')::timestamptz > $4::timestamptz),
          'neverObservedSourceCount', count(*) FILTER (WHERE collection_executable AND observation_count = 0),
          'healthySourceCount', count(*) FILTER (WHERE collection_executable AND latest_success AND COALESCE(latest_parser_warning_count, 0) = 0),
          'degradedSourceCount', count(*) FILTER (WHERE collection_executable AND latest_success AND COALESCE(latest_parser_warning_count, 0) > 0),
          'failedSourceCount', count(*) FILTER (WHERE collection_executable AND latest_success = FALSE),
          'falsePositiveMeasuredSourceCount', 0,
          'dailySourceCount', count(*) FILTER (WHERE collection_executable AND COALESCE((record->>'crawlFrequencySeconds')::int, 86400) <= 86400),
          'dailyAttemptedCount', count(*) FILTER (WHERE collection_executable AND COALESCE((record->>'crawlFrequencySeconds')::int, 86400) <= 86400 AND last_checked_at >= $4::timestamptz - interval '24 hours'),
          'dailyCoveredCount', count(*) FILTER (WHERE collection_executable AND COALESCE((record->>'crawlFrequencySeconds')::int, 86400) <= 86400 AND last_success_at >= $4::timestamptz - interval '24 hours'),
          'requiredChecksPerDay', COALESCE(sum(CASE WHEN collection_executable THEN GREATEST(1, ceil(86400.0 / GREATEST(300, COALESCE((record->>'crawlFrequencySeconds')::int, 86400)))) ELSE 0 END), 0),
          'nextEligibleAt', min(NULLIF(record->'crawlState'->>'nextEligibleAt', '')::timestamptz) FILTER (WHERE collection_executable),
          'qualifyingClearWebSourceCount', count(*) FILTER (WHERE runtime_qualifies AND canonical_rank = 1 AND source_type IN ('rss','api','json_api','blog')),
          'qualifyingLawfulDarkWebSourceCount', count(*) FILTER (WHERE runtime_qualifies AND canonical_rank = 1 AND source_type IN ('tor_metadata','darkweb_metadata') AND COALESCE((record->'governance'->>'metadataOnly')::boolean, (record->'metadata'->>'captureMode') = 'metadata_only')),
          'qualifyingPublicTelegramSourceCount', count(*) FILTER (WHERE runtime_qualifies AND canonical_rank = 1 AND source_type = 'telegram_public'),
          'latestRun', (SELECT record FROM latest_run),
          'lastSuccessfulRun', (SELECT record FROM successful_run)
        ) AS totals
        FROM ranked
      `, [tenantId, sourceId, executableOnly, input.generatedAt, automaticReviewModelVersion()])
    ]);
    const totals = totalRows[0]?.totals ?? {};
    const total = Number(totals.sourceCount ?? 0);
    return { rows, totals, total, nextCursor: offset + rows.length < total ? String(offset + rows.length) : undefined };
  }

  override async listActorProfilesForOwnership(): Promise<any[]> {
    return (await this.sql`SELECT record FROM threat_intel.actor_profiles ORDER BY first_seen_at, id`).map(readRecord);
  }

  override async listActorAliasesForOwnership(): Promise<any[]> {
    return (await this.sql`SELECT record FROM threat_intel.actor_aliases ORDER BY first_seen_at, id`).map(readRecord);
  }

  override async listActorProfileIdentityHistoryForOwnership(): Promise<any[]> {
    return (await this.sql`
      SELECT jsonb_build_object(
        'id', id,
        'actorProfileId', actor_profile_id,
        'canonicalActorProfileId', canonical_actor_profile_id,
        'reconciliationKey', reconciliation_key,
        'resolutionStatus', resolution_status,
        'originalTenantId', original_tenant_id,
        'originalRecord', original_record,
        'referenceSnapshot', reference_snapshot,
        'reconciledAt', reconciled_at
      ) AS record
      FROM threat_intel.actor_profile_identity_history
      ORDER BY reconciled_at, actor_profile_id
    `).map(readRecord);
  }

  override async replaceActorProfileIdentityHistoryForRetention(record: any): Promise<any> {
    if (!record?.id || !record.actorProfileId || !record.originalRecord || !record.referenceSnapshot) {
      throw new Error("Actor profile identity history retention replacement requires identity and retained audit payloads.");
    }
    const [updated] = await this.sql`
      UPDATE threat_intel.actor_profile_identity_history
      SET
        original_tenant_id = ${nullable(record.originalTenantId)},
        original_record = ${toJson(record.originalRecord)}::text::jsonb,
        reference_snapshot = ${toJson(record.referenceSnapshot)}::text::jsonb
      WHERE id = ${record.id} AND actor_profile_id = ${record.actorProfileId}
      RETURNING jsonb_build_object(
        'id', id,
        'actorProfileId', actor_profile_id,
        'canonicalActorProfileId', canonical_actor_profile_id,
        'reconciliationKey', reconciliation_key,
        'resolutionStatus', resolution_status,
        'originalTenantId', original_tenant_id,
        'originalRecord', original_record,
        'referenceSnapshot', reference_snapshot,
        'reconciledAt', reconciled_at
      ) AS record
    `;
    if (!updated) throw new Error(`Unknown actor profile identity history: ${record.id}`);
    return readRecord(updated);
  }

  async importLegacySnapshot(snapshotPath: string) {
    const file = Bun.file(snapshotPath);
    if (!(await file.exists())) return { imported: false, reason: "legacy_snapshot_missing", counts: {} };
    if (this.hasStoredData()) return { imported: false, reason: "database_not_empty", counts: {} };
    const snapshot = JSON.parse(await file.text()) as Record<string, any[]>;
    await this.batch(() => {
      for (const source of snapshot.sources ?? []) this.saveSource(normalizeLegacySourceForImport(source));
      for (const capture of snapshot.captures ?? []) this.saveCapture(capture);
      for (const identity of snapshot.actorIdentities ?? []) this.hydrateActorIdentitySnapshot(identity);
      for (const catalog of snapshot.actorIdentityCatalogs ?? []) this.replaceActorIdentityCatalog({
        ...catalog,
        identities: (catalog.identityIds ?? []).map((id: string) => this.getActorIdentity(id)).filter(Boolean)
      }, {
        sourceId: catalog.sourceId,
        captureId: catalog.captureId,
        importedAt: catalog.importedAt ?? catalog.retrievedAt
      });
      for (const incident of snapshot.incidents ?? []) {
        const capture = this.getCapture(incident.captureId);
        if (capture) this.savePipelineResult({ capture, incident, entities: incident.entities ?? [], indicators: incident.indicators ?? [] });
        else this.saveIncident(incident);
      }
      for (const entity of snapshot.extractedEntities ?? []) this.saveExtractedEntity(entity);
      for (const indicator of snapshot.indicators ?? []) this.saveIndicator(indicator);
      for (const profile of snapshot.actorProfiles ?? []) this.saveActorProfile(profile);
      for (const linkRecord of snapshot.evidenceLinks ?? []) this.saveEvidenceLink(linkRecord);
      for (const record of snapshot.validationRecords ?? []) this.saveValidationRecord(record);
      for (const label of snapshot.evaluationLabels ?? []) this.saveEvaluationLabel(label);
      for (const claim of snapshot.intelligenceClaims ?? []) this.saveIntelligenceClaim(claim);
      for (const evidence of snapshot.claimEvidence ?? []) this.saveClaimEvidence(evidence);
      for (const review of snapshot.claimReviews ?? []) this.saveClaimReview(review);
      for (const observation of snapshot.sourceHealthObservations ?? []) this.saveSourceHealthObservation(observation);
      for (const record of snapshot.timelinessRecords ?? []) this.saveTimelinessRecord(record);
      for (const [snapshotKey, recordType, save] of legacyWorkflowLoaders) {
        for (const record of snapshot[snapshotKey] ?? []) {
          if (recordType === "dwm_webhook_delivery") this.saveWorkflow(recordType, record, () => this.hydrateDwmWebhookDeliverySnapshot(record));
          else save(this, record);
        }
      }
    });
    return {
      imported: true,
      reason: "legacy_snapshot_imported",
      counts: {
        sources: this.listSources().length,
        captures: this.listCaptures().length,
        incidents: this.listIncidents().length,
        entities: this.listExtractedEntities().length,
        indicators: this.listIndicators().length,
        actorProfiles: this.listActorProfiles().length,
        workflowRecords: legacyWorkflowLoaders.reduce((count, [key]) => count + (snapshot[key]?.length ?? 0), 0)
      }
    };
  }

  override saveCaptureWithDedupe(capture: RawCapture): CaptureWriteResult {
    const result = super.saveCaptureWithDedupe(capture);
    if (result.status === "inserted" && !this.pipelineDepth) this.enqueue(`capture:${result.capture.id}`, () => this.persistCapture(result.capture));
    return result;
  }

  override updateCaptureMetadata(id: string, update: (metadata: any) => any): RawCapture {
    const capture = super.updateCaptureMetadata(id, update);
    this.enqueue(`capture-metadata:${id}`, () => this.persistCaptureMetadata(capture));
    return capture;
  }

  override replaceCaptureForRetention(capture: RawCapture): RawCapture {
    const stored = super.replaceCaptureForRetention(capture);
    this.enqueue(`capture-retention:${capture.id}`, () => this.persistCaptureRetention(stored));
    return stored;
  }

  override savePipelineResult(result: PipelineResult): PipelineResult {
    this.pipelineDepth++;
    try {
      const stored = super.savePipelineResult(result);
      const captureId = stored.capture.id;
      const incidentId = stored.incident?.id;
      const snapshot = structuredClone({
        capture: stored.capture,
        incident: incidentId ? this.getIncident(incidentId) : undefined,
        entities: this.listExtractedEntities().filter((record: any) => record.captureId === captureId),
        indicators: this.listIndicators().filter((record: any) => record.captureId === captureId),
        profiles: this.listActorProfiles().filter((record: any) => record.captureIds?.includes(captureId)),
        claims: this.listIntelligenceClaims().filter((record: any) => record.captureIds?.includes(captureId)),
        claimEvidence: this.listClaimEvidence().filter((record: any) => record.captureId === captureId),
        links: this.listEvidenceLinks().filter((record: any) => record.captureId === captureId && (record.subjectType !== "incident" || record.subjectId === incidentId)),
        timeliness: incidentId ? this.getTimelinessRecord(incidentId) : undefined,
        deltas: this.listEvidenceDeltas().filter((record: any) => record.captureIds?.includes(captureId))
      });
      this.enqueue(`pipeline:${captureId}`, () => this.persistPipeline(snapshot));
      return stored;
    } finally {
      this.pipelineDepth--;
    }
  }

  override saveIncident(candidate: IncidentCandidate): IncidentCandidate {
    const stored = super.saveIncident(candidate);
    if (!this.pipelineDepth) this.enqueue(`incident:${stored.id}`, () => this.persistIncident(stored));
    return stored;
  }

  override saveExtractedEntity(entity: any): any {
    const stored = super.saveExtractedEntity(entity);
    if (!this.pipelineDepth) this.enqueue(`entity:${stored.id}`, () => this.persistEntity(stored));
    return stored;
  }

  override saveIndicator(indicator: any): any {
    const stored = super.saveIndicator(indicator);
    if (!this.pipelineDepth) this.enqueue(`indicator:${stored.id}`, () => this.persistIndicator(stored));
    return stored;
  }

  override saveActorProfile(profile: any): any {
    const stored = super.saveActorProfile(profile);
    if (!this.pipelineDepth) this.enqueue(`actor-profile:${stored.id}`, () => this.persistActorProfile(stored));
    return stored;
  }

  override replaceActorIdentityCatalog(
    snapshot: Parameters<InMemoryScraperStore["replaceActorIdentityCatalog"]>[0],
    provenance: Parameters<InMemoryScraperStore["replaceActorIdentityCatalog"]>[1]
  ) {
    this.pipelineDepth++;
    let result;
    try {
      result = super.replaceActorIdentityCatalog(snapshot, provenance);
    } finally {
      this.pipelineDepth--;
    }
    const catalog = structuredClone(this.getActorIdentityCatalog(snapshot.catalogId));
    const identities = structuredClone(this.listActorIdentities());
    const archivedIds = new Set(result.archivedActorProfileIds);
    const changedProfiles = [...result.archivedActorProfileIds, ...result.reboundActorProfileIds]
      .map((id: string) => structuredClone(this.getActorProfile(id)));
    this.enqueue(`actor-identity-catalog:${catalog.id}`, () => persistActorIdentityCatalog(
      this.sql,
      catalog,
      identities,
      async (transaction) => {
        for (const profile of changedProfiles) {
          if (archivedIds.has(profile.id)) await this.persistActorProfileArchiveHistory(profile.id, catalog.importedAt, transaction);
          await this.persistActorProfile(profile, transaction);
        }
      }
    ));
    return result;
  }

  override saveIntelligenceClaim(claim: any): any {
    const stored = super.saveIntelligenceClaim(claim);
    if (!this.pipelineDepth) this.enqueue(`claim:${stored.id}`, () => this.persistIntelligenceClaim(stored));
    return stored;
  }

  override saveClaimEvidence(evidence: any): any {
    const stored = super.saveClaimEvidence(evidence);
    if (!this.pipelineDepth) this.enqueue(`claim-evidence:${stored.id}`, () => this.persistClaimEvidence(stored));
    return stored;
  }

  override saveClaimReview(review: any): any {
    this.pipelineDepth++;
    let stored: any;
    try {
      stored = super.saveClaimReview(review);
    } finally {
      this.pipelineDepth--;
    }
    this.enqueue(`claim-review:${review.id}`, () => this.persistClaimReview(stored.review, stored.claim));
    return stored;
  }

  override saveTimelinessRecord(record: any): any {
    const stored = super.saveTimelinessRecord(record);
    if (!this.pipelineDepth) this.enqueue(`timeliness:${stored.id}`, () => this.persistTimeliness(stored));
    return stored;
  }

  override saveSourceHealthObservation(observation: any): any {
    validateSourceHealthObservation(observation);
    const stored = super.saveSourceHealthObservation(observation);
    this.enqueue(`source-health:${stored.id}`, () => this.persistSourceHealth(stored));
    return stored;
  }

  override saveEvidenceLink(linkRecord: any): any {
    if (linkRecord.subjectType === "incident" && !this.getIncident(linkRecord.subjectId)) throw new Error(`Unknown incident evidence subject: ${linkRecord.subjectId}`);
    const stored = super.saveEvidenceLink(linkRecord);
    if (!this.pipelineDepth) this.enqueue(`evidence-link:${stored.id}`, () => this.persistEvidenceLink(stored));
    return stored;
  }

  override saveValidationRecord(record: EvaluationValidationRecord): EvaluationValidationRecord {
    validateValidationRecord(record);
    const stored = super.saveValidationRecord(record);
    this.enqueue(`validation:${stored.id}`, () => this.persistValidationRecord(stored));
    return stored;
  }

  override saveEvaluationLabel(label: EvaluationLabelRecord): EvaluationLabelRecord {
    validateEvaluationLabel(label);
    const stored = super.saveEvaluationLabel(label);
    this.enqueue(`evaluation-label:${stored.id}`, () => this.persistEvaluationLabel(stored));
    return stored;
  }
  override saveEvaluationBenchmark(record: EvaluationBenchmarkRecord): EvaluationBenchmarkRecord { return this.saveWorkflow("evaluation_benchmark", record, () => super.saveEvaluationBenchmark(record)); }
  override updateEvaluationBenchmarkTask(id: string, taskId: string, update: (task: EvaluationTaskRecord) => EvaluationTaskRecord) {
    const stored = super.updateEvaluationBenchmarkTask(id, taskId, update);
    this.enqueue(`evaluation_benchmark_task:${id}:${taskId}`, async () => {
      await this.sql`
        UPDATE threat_intel.workflow_records
        SET record = jsonb_set(
          jsonb_set(record, ARRAY['manifest', ${String(stored.index)}], ${toJson(stored.task)}::text::jsonb, false),
          ARRAY['updatedAt'], to_jsonb(${stored.benchmark.updatedAt}::text), true
        ), updated_at = ${stored.benchmark.updatedAt}
        WHERE record_type = 'evaluation_benchmark' AND id = ${id}
      `;
    });
    return stored;
  }
  override patchEvaluationBenchmark(id: string, patch: Partial<EvaluationBenchmarkRecord>): EvaluationBenchmarkRecord {
    const benchmark = super.patchEvaluationBenchmark(id, patch);
    const clearCompletedAt = Object.prototype.hasOwnProperty.call(patch, "completedAt") && patch.completedAt === undefined;
    this.enqueue(`evaluation_benchmark_patch:${id}`, async () => {
      await this.sql`
        UPDATE threat_intel.workflow_records
        SET record = (CASE WHEN ${clearCompletedAt} THEN record - 'completedAt' ELSE record END) || ${toJson(patch)}::text::jsonb,
            updated_at = ${benchmark.updatedAt}
        WHERE record_type = 'evaluation_benchmark' AND id = ${id}
      `;
    });
    return benchmark;
  }
  override saveEvaluationAnnotation(record: EvaluationAnnotationRecord): EvaluationAnnotationRecord { return this.saveWorkflow("evaluation_annotation", record, () => super.saveEvaluationAnnotation(record)); }
  override saveEvaluationAdjudication(record: EvaluationAdjudicationRecord): EvaluationAdjudicationRecord { return this.saveWorkflow("evaluation_adjudication", record, () => super.saveEvaluationAdjudication(record)); }

  override saveSource(source: SourceRecord): SourceRecord {
    const stored = super.saveSource(source);
    this.enqueue(`source:${stored.id}`, () => this.persistSource(stored));
    return stored;
  }

  override savePlan(plan: CollectionPlan): CollectionPlan { return this.saveWorkflow("collection_plan", plan, () => super.savePlan(plan)); }
  override saveRun(run: CollectionRun): CollectionRun {
    const stored = super.saveRun(run);
    this.enqueue(`collection-run:${stored.id}`, () => this.persistCollectionRun(stored));
    return stored;
  }
  override createReplayJob(input: Parameters<InMemoryScraperStore["createReplayJob"]>[0]): CaptureReplayJob { const record = super.createReplayJob(input); return this.saveWorkflow("replay_job", record, () => record); }
  override saveReplayJob(job: CaptureReplayJob): CaptureReplayJob { return this.saveWorkflow("replay_job", job, () => super.saveReplayJob(job)); }
  override recordReplayResult(jobId: string, result: PipelineResult): CaptureReplayJob { const record = super.recordReplayResult(jobId, result); return this.saveWorkflow("replay_job", record, () => record); }
  override saveDiscoveryEvidence(evidence: DiscoveryEvidence): DiscoveryEvidence { return this.saveWorkflow("discovery_evidence", evidence, () => super.saveDiscoveryEvidence(evidence)); }
  override promoteDiscoveryEvidence(promotion: DiscoveryPromotion): DiscoveryEvidence { const record = super.promoteDiscoveryEvidence(promotion); return this.saveWorkflow("discovery_evidence", record, () => record); }
  override saveLiveSearchSnapshot(snapshot: LiveSearchSnapshot): LiveSearchSnapshot { return this.saveWorkflow("live_search_snapshot", snapshot, () => super.saveLiveSearchSnapshot(snapshot)); }
  override saveEvidenceDelta(delta: EvidenceDelta): EvidenceDelta {
    const stored = super.saveEvidenceDelta(delta);
    if (!this.pipelineDepth) this.enqueue(`evidence_delta:${stored.id}`, () => this.persistWorkflow("evidence_delta", stored));
    return stored;
  }
  override saveAnalystMetadataReviewTask(task: AnalystMetadataReviewTask): AnalystMetadataReviewTask { return this.saveWorkflow("analyst_metadata_review_task", task, () => super.saveAnalystMetadataReviewTask(task)); }
  override saveAnalystSourceActivationPacket(packet: AnalystSourceActivationPacket): AnalystSourceActivationPacket { return this.saveWorkflow("analyst_source_activation_packet", packet, () => super.saveAnalystSourceActivationPacket(packet)); }
  override saveAnalystVictimNotificationPacket(packet: AnalystVictimNotificationPacket): AnalystVictimNotificationPacket { return this.saveWorkflow("analyst_victim_notification_packet", packet, () => super.saveAnalystVictimNotificationPacket(packet)); }
  override saveAnalystClaimLedgerEntry(entry: AnalystClaimLedgerEntry): AnalystClaimLedgerEntry {
    this.pipelineDepth++;
    let stored: AnalystClaimLedgerEntry;
    try {
      stored = super.saveAnalystClaimLedgerEntry(entry);
    } finally {
      this.pipelineDepth--;
    }
    this.enqueue(`analyst-claim:${stored.id}`, () => this.persistAnalystClaim(stored.id));
    return stored;
  }
  override saveAnalystLoopSnapshot(snapshot: AnalystLoopSnapshot): AnalystLoopSnapshot { return this.saveWorkflow("analyst_loop_snapshot", snapshot, () => super.saveAnalystLoopSnapshot(snapshot)); }
  override saveOrganization(record: any): any { return this.saveWorkflow("organization", record, () => super.saveOrganization(record)); }
  override saveOrganizationMember(record: any): any { return this.saveWorkflow("organization_member", record, () => super.saveOrganizationMember(record)); }
  override saveOrganizationInvite(record: any): any { return this.saveWorkflow("organization_invite", record, () => super.saveOrganizationInvite(record)); }
  override saveWebhookDestination(record: any): any { return this.saveWorkflow("webhook_destination", record, () => super.saveWebhookDestination(record)); }
  override saveCase(record: any): any { return this.saveWorkflow("case", record, () => super.saveCase(record)); }
  override saveDwmWatchlist(record: any): any { return this.saveWorkflow("dwm_watchlist", record, () => super.saveDwmWatchlist(record)); }
  override replaceRecordForRetention(recordType: string, record: any): any {
    const stored = super.replaceRecordForRetention(recordType, record);
    if (stored) this.enqueue(`retention-redact:${recordType}:${record.id}`, () => this.persistPrivacyRedaction(recordType, stored));
    return stored;
  }
  override deleteWorkflowForRetention(recordType: string, id: string, audit?: { organizationId: string; runId: string; item: any }): boolean {
    const deleted = super.deleteWorkflowForRetention(recordType, id, audit);
    if (deleted) {
      const organization = audit ? structuredClone(this.getOrganization(audit.organizationId)) : undefined;
      this.enqueue(`retention-delete:${recordType}:${id}`, async () => {
        await this.sql.begin(async sql => {
          const removed = await sql`DELETE FROM threat_intel.workflow_records WHERE record_type = ${recordType} AND id = ${id} RETURNING id`;
          if (!removed.length) throw new Error(`Stored ${recordType} disappeared before PostgreSQL privacy deletion: ${id}`);
          if (organization) await this.persistWorkflow("organization", organization, sql);
        });
      });
    }
    return deleted;
  }
  override saveDwmAlert(alert: any): any {
    const captureIds = new Set(linkedAlertCaptureIds(alert));
    const linkedIncidentIds = new Set(this.listTimelinessRecords()
      .filter((record: any) => record.incidentId === alert.incidentId || captureIds.has(record.captureId))
      .map((record: any) => record.incidentId));
    const stored = super.saveDwmAlert(alert);
    this.enqueue(`alert:${stored.id}`, () => this.persistAlert(stored));
    for (const incidentId of linkedIncidentIds) {
      const timeliness = this.getTimelinessRecord(incidentId);
      if (timeliness?.alertCreatedAt) this.enqueue(`timeliness:${timeliness.id}`, () => this.persistTimeliness(timeliness));
    }
    return stored;
  }
  override saveDwmWebhookDelivery(record: any): any {
    const alert = this.getDwmAlert(record.alertId);
    const captureIds = new Set(alert ? linkedAlertCaptureIds(alert) : []);
    const linkedIncidentIds = new Set(this.listTimelinessRecords()
      .filter((timeliness: any) => alert && (timeliness.incidentId === alert.incidentId || captureIds.has(timeliness.captureId)))
      .map((timeliness: any) => timeliness.incidentId));
    const stored = this.saveWorkflow("dwm_webhook_delivery", record, () => super.saveDwmWebhookDelivery(record));
    for (const incidentId of linkedIncidentIds) {
      const timeliness = this.getTimelinessRecord(incidentId);
      if (timeliness) this.enqueue(`timeliness:${timeliness.id}`, () => this.persistTimeliness(timeliness));
    }
    return stored;
  }
  override saveActorOrgRelevanceReview(record: any): any { return this.saveWorkflow("actor_org_relevance_review", record, () => super.saveActorOrgRelevanceReview(record)); }

  private async migrate(): Promise<void> {
    await this.sql.unsafe(`
      CREATE SCHEMA IF NOT EXISTS threat_intel;
      CREATE TABLE IF NOT EXISTS threat_intel.schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    for (const migration of this.migrations) {
      const sqlText = await Bun.file(migration.path).text();
      await this.sql.begin(async (sql) => {
        await sql`SELECT pg_advisory_xact_lock(hashtext(${'hanasand:threat-intel:migrations'}))`;
        const [applied] = await sql<{ version: string }[]>`
          SELECT version FROM threat_intel.schema_migrations WHERE version = ${migration.version}
        `;
        if (applied) return;
        await sql.unsafe(sqlText);
        await sql`INSERT INTO threat_intel.schema_migrations (version) VALUES (${migration.version})`;
      });
    }
  }

  private async hydrate(): Promise<void> {
    const [sources, captures, incidents, entities, indicators, actorProfiles, actorIdentityCatalogs, actorIdentities, evidenceLinks, validations, alerts, evaluationLabels, sourceHealth, timeliness, runs, claims, claimEvidence, claimReviews, workflows] = await Promise.all([
      this.sql`SELECT record FROM threat_intel.sources ORDER BY created_at`,
      this.sql`SELECT record FROM threat_intel.captures ORDER BY collected_at`,
      this.sql`SELECT record FROM threat_intel.incidents ORDER BY first_seen_at`,
      this.sql`SELECT record FROM threat_intel.entities ORDER BY created_at`,
      this.sql`SELECT record FROM threat_intel.indicators ORDER BY created_at`,
      this.sql`SELECT record FROM threat_intel.actor_profiles ORDER BY first_seen_at`,
      this.sql`SELECT record FROM threat_intel.actor_identity_catalogs ORDER BY retrieved_at`,
      this.sql`SELECT record FROM threat_intel.actor_identities ORDER BY catalog_id, external_id`,
      this.sql`SELECT record FROM threat_intel.evidence_links ORDER BY created_at`,
      this.sql`SELECT record FROM threat_intel.validation_records ORDER BY matched_at`,
      this.sql`SELECT record FROM threat_intel.alerts ORDER BY first_seen_at`,
      this.sql`SELECT record FROM threat_intel.evaluation_labels ORDER BY labeled_at`,
      this.sql`SELECT record FROM threat_intel.source_health ORDER BY checked_at`,
      this.sql`SELECT record FROM threat_intel.timeliness_records ORDER BY first_visible_at`,
      this.sql`SELECT record FROM threat_intel.collection_runs ORDER BY started_at`,
      this.sql`SELECT record FROM threat_intel.intelligence_claims ORDER BY first_seen_at`,
      this.sql`SELECT record FROM threat_intel.claim_evidence ORDER BY created_at`,
      this.sql`SELECT record FROM threat_intel.claim_reviews ORDER BY reviewed_at`,
      this.sql`SELECT record_type, record FROM threat_intel.workflow_records ORDER BY created_at`
    ]);
    this.hydrateWithoutOrganizationWriteGuard(() => {
    for (const row of sources) super.saveSource(readRecord(row));
    for (const row of captures) this.hydrateCaptureSnapshot(readRecord(row));
    for (const row of incidents) super.saveIncident(readRecord(row));
    for (const row of entities) super.saveExtractedEntity(readRecord(row));
    for (const row of indicators) super.saveIndicator(readRecord(row));
    for (const row of actorProfiles) super.saveActorProfile(readRecord(row));
    for (const row of actorIdentityCatalogs) this.hydrateActorIdentityCatalogSnapshot(readRecord(row));
    for (const row of actorIdentities) this.hydrateActorIdentitySnapshot(readRecord(row));
    for (const row of evidenceLinks) {
      const record = readRecord(row);
      if (record.subjectType !== "incident" || this.getIncident(record.subjectId)) super.saveEvidenceLink(record);
    }
    for (const row of validations) super.saveValidationRecord(readRecord(row));
    for (const row of alerts) super.saveDwmAlert(readRecord(row));
    for (const row of evaluationLabels) super.saveEvaluationLabel(readRecord(row));
    for (const row of sourceHealth) super.saveSourceHealthObservation(readRecord(row));
    for (const row of timeliness) this.hydrateTimelinessSnapshot(readRecord(row));
    for (const row of runs) super.saveRun(readRecord(row));
    for (const row of claims) super.saveIntelligenceClaim(readRecord(row));
    for (const row of claimEvidence) super.saveClaimEvidence(readRecord(row));
    for (const row of claimReviews) super.saveClaimReview(readRecord(row));
    for (const row of workflows) this.hydrateWorkflow(String(row.record_type), readRecord(row));
    });
    this.pipelineDepth++;
    const reconciledAt = new Date().toISOString();
    let reconciliation = { archivedActorProfileIds: [] as string[], reboundActorProfileIds: [] as string[] };
    try {
      reconciliation = this.reconcileActorProfilesForCatalog(reconciledAt);
    } finally {
      this.pipelineDepth--;
    }
    const archivedIds = new Set(reconciliation.archivedActorProfileIds);
    const changedIds = [...reconciliation.archivedActorProfileIds, ...reconciliation.reboundActorProfileIds];
    if (changedIds.length) await this.sql.begin(async (transaction) => {
      for (const id of changedIds) {
        if (archivedIds.has(id)) await this.persistActorProfileArchiveHistory(id, reconciledAt, transaction);
        await this.persistActorProfile(this.getActorProfile(id), transaction);
      }
    });
  }

  private async backfillSourceOperationalKeys(): Promise<void> {
    for (const source of this.listSources()) {
      const executable = isExecutableSource(source);
      await this.sql`
        UPDATE threat_intel.sources
        SET canonical_feed_key = ${source.url ? canonicalFeedKey(source.url) : null},
            collection_executable = ${executable}
        WHERE id = ${source.id}
          AND (canonical_feed_key IS NULL OR collection_executable IS DISTINCT FROM ${executable})
      `;
    }
  }

  private hasStoredData(): boolean {
    return this.listSources().length > 0 || this.listCaptures().length > 0 || this.listIncidents().length > 0 || this.listActorIdentityCatalogs().length > 0 || this.listDwmAlerts().length > 0 || legacyWorkflowLoaders.some(([, , , list]) => list(this).length > 0);
  }

  private enqueue(description: string, run: () => Promise<void>): void {
    this.pendingWrites.push({ description, run });
    if (!this.draining && !this.lastWriteError) this.startDrain();
  }

  private startDrain(): void {
    if (this.draining || !this.pendingWrites.length) return;
    this.draining = this.drain().finally(() => { this.draining = undefined; });
  }

  private async drain(): Promise<void> {
    while (this.pendingWrites.length) {
      const write = this.pendingWrites[0];
      try {
        await write.run();
        this.pendingWrites.shift();
        this.lastWriteError = undefined;
      } catch (error) {
        this.lastWriteError = error instanceof Error ? error : new Error(String(error));
        return;
      }
    }
  }

  private saveWorkflow<T extends { id: string }>(recordType: string, record: T, save: () => T): T {
    const stored = save();
    this.enqueue(`${recordType}:${stored.id}`, () => this.persistWorkflow(recordType, stored));
    return stored;
  }

  private hydrateWorkflow(recordType: string, record: any): void {
    switch (recordType) {
      case "collection_plan": super.savePlan(record); break;
      case "collection_run": super.saveRun(record); break;
      case "replay_job": super.saveReplayJob(record); break;
      case "discovery_evidence": this.hydrateDiscoveryEvidenceSnapshot(record); break;
      case "live_search_snapshot": this.hydrateLiveSearchSnapshotSnapshot(record); break;
      case "evidence_delta": this.hydrateEvidenceDeltaSnapshot(record); break;
      case "analyst_metadata_review_task": super.saveAnalystMetadataReviewTask(record); break;
      case "analyst_source_activation_packet": super.saveAnalystSourceActivationPacket(record); break;
      case "analyst_victim_notification_packet": super.saveAnalystVictimNotificationPacket(record); break;
      case "analyst_claim_ledger_entry": super.saveAnalystClaimLedgerEntry(record); break;
      case "analyst_loop_snapshot": super.saveAnalystLoopSnapshot(record); break;
      case "evaluation_benchmark": super.saveEvaluationBenchmark(record); break;
      case "evaluation_annotation": super.saveEvaluationAnnotation(record); break;
      case "evaluation_adjudication": super.saveEvaluationAdjudication(record); break;
      case "organization": super.saveOrganization(record); break;
      case "organization_member": super.saveOrganizationMember(record); break;
      case "organization_invite": super.saveOrganizationInvite(record); break;
      case "webhook_destination": super.saveWebhookDestination(record); break;
      case "case": super.saveCase(record); break;
      case "dwm_watchlist": super.saveDwmWatchlist(record); break;
      case "dwm_webhook_delivery": this.hydrateDwmWebhookDeliverySnapshot(record); break;
      case "actor_org_relevance_review": super.saveActorOrgRelevanceReview(record); break;
    }
  }

  private async persistPipeline(snapshot: {
    capture: RawCapture; incident?: any; entities: any[]; indicators: any[]; profiles: any[];
    claims: any[]; claimEvidence: any[]; links: any[]; timeliness?: any; deltas: any[];
  }): Promise<void> {
    const { capture, incident, entities, indicators, profiles, claims, claimEvidence, links, timeliness, deltas } = snapshot;
    await this.sql.begin(async (sql) => {
      await this.persistCapture(capture, sql);
      if (incident) await this.persistIncident(incident, sql);
      for (const entity of entities) await this.persistEntity(entity, sql);
      for (const indicator of indicators) await this.persistIndicator(indicator, sql);
      for (const profile of profiles) await this.persistActorProfile(profile, sql);
      for (const claim of claims) await this.persistIntelligenceClaim(claim, sql);
      for (const evidence of claimEvidence) await this.persistClaimEvidence(evidence, sql);
      for (const linkRecord of links) await this.persistEvidenceLink(linkRecord, sql);
      if (timeliness) await this.persistTimeliness(timeliness, sql);
      for (const delta of deltas) await this.persistWorkflow("evidence_delta", delta, sql);
    });
  }

  private async persistSource(source: any, sql: any = this.sql): Promise<void> {
    const createdAt = source.createdAt ?? source.updatedAt ?? new Date().toISOString();
    const updatedAt = source.updatedAt ?? createdAt;
    await sql`
      INSERT INTO threat_intel.sources (
        id, tenant_id, name, source_type, url, access_method, status, risk,
        trust_score, crawl_frequency_seconds, last_seen_at, created_at, updated_at,
        canonical_feed_key, collection_executable, record
      ) VALUES (
        ${source.id}, ${nullable(source.tenantId)}, ${source.name}, ${source.type}, ${source.url},
        ${source.accessMethod}, ${source.status}, ${source.risk}, ${score(source.trustScore)},
        ${Math.max(1, Number(source.crawlFrequencySeconds ?? 3600))}, ${nullable(source.lastSeenAt)},
        ${createdAt}, ${updatedAt}, ${source.url ? canonicalFeedKey(source.url) : null},
        ${isExecutableSource(source)}, ${toJson(source)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        name = EXCLUDED.name,
        source_type = EXCLUDED.source_type,
        url = EXCLUDED.url,
        access_method = EXCLUDED.access_method,
        status = EXCLUDED.status,
        risk = EXCLUDED.risk,
        trust_score = EXCLUDED.trust_score,
        crawl_frequency_seconds = EXCLUDED.crawl_frequency_seconds,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = EXCLUDED.updated_at,
        canonical_feed_key = EXCLUDED.canonical_feed_key,
        collection_executable = EXCLUDED.collection_executable,
        record = EXCLUDED.record
    `;
  }

  private async persistCapture(capture: any, sql: any = this.sql): Promise<void> {
    await sql`
      INSERT INTO threat_intel.captures (
        id, tenant_id, source_id, task_id, url, canonical_url, collected_at, published_at, processed_at, first_visible_at,
        content_hash, normalized_text_hash, media_type, storage_kind, body, object_ref,
        sensitive, retention_class, extractor_version, record
      ) VALUES (
        ${capture.id}, ${nullable(capture.tenantId)}, ${capture.sourceId}, ${nullable(capture.taskId)},
        ${capture.url}, ${capture.canonicalUrl ?? capture.url}, ${capture.collectedAt}, ${nullable(capture.publishedAt)},
        ${capture.processedAt ?? capture.collectedAt}, ${capture.firstVisibleAt ?? capture.processedAt ?? capture.collectedAt},
        ${capture.contentHash}, ${nullable(capture.normalizedTextHash)}, ${capture.mediaType ?? "application/octet-stream"},
        ${capture.storageKind ?? "metadata_only"}, ${nullable(capture.body)},
        ${capture.objectRef ? toJson(capture.objectRef) : null}::text::jsonb, ${Boolean(capture.sensitive)},
        ${capture.retentionClass ?? "standard"}, ${nullable(capture.provenance?.extractorVersion)}, ${toJson(capture)}::text::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  private async persistCaptureMetadata(capture: any): Promise<void> {
    await this.sql`
      UPDATE threat_intel.captures
      SET record = ${toJson(capture)}::text::jsonb,
          extractor_version = ${nullable(capture.provenance?.extractorVersion)},
          processed_at = COALESCE(processed_at, ${nullable(capture.processedAt)}),
          first_visible_at = COALESCE(first_visible_at, ${nullable(capture.firstVisibleAt)})
      WHERE id = ${capture.id}
    `;
  }

  private async persistCaptureRetention(capture: any): Promise<void> {
    await this.sql`
      UPDATE threat_intel.captures
      SET body = ${nullable(capture.body)},
          object_ref = ${capture.objectRef ? toJson(capture.objectRef) : null}::text::jsonb,
          storage_kind = ${capture.storageKind ?? "metadata_only"},
          retention_class = ${capture.retentionClass ?? "standard"},
          record = ${toJson(capture)}::text::jsonb
      WHERE id = ${capture.id}
    `;
  }

  private async persistIncident(incident: any, sql: any = this.sql): Promise<void> {
    const capture = this.getCapture(incident.captureId);
    await sql`
      INSERT INTO threat_intel.incidents (
        id, tenant_id, source_id, capture_id, title, summary, first_seen_at,
        reported_at, published_at, collected_at, processed_at, first_visible_at,
        confidence, extractor_version, review_state, updated_at, record
      ) VALUES (
        ${incident.id}, ${nullable(incident.tenantId ?? capture?.tenantId)}, ${incident.sourceId ?? capture?.sourceId},
        ${incident.captureId}, ${incident.title ?? incident.id}, ${incident.summary ?? ""},
        ${incident.firstSeenAt ?? capture?.collectedAt ?? new Date().toISOString()},
        ${nullable(incident.reportedAt)}, ${nullable(incident.publishedAt ?? capture?.publishedAt)},
        ${incident.collectedAt ?? capture?.collectedAt ?? new Date().toISOString()},
        ${incident.processedAt ?? capture?.processedAt ?? new Date().toISOString()},
        ${incident.firstVisibleAt ?? capture?.firstVisibleAt ?? new Date().toISOString()}, ${score(incident.confidence)},
        ${incident.extractorVersion ?? capture?.provenance?.extractorVersion ?? "unknown"},
        ${incident.reviewState ?? "unreviewed"}, ${incident.updatedAt ?? new Date().toISOString()}, ${toJson(incident)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        source_id = EXCLUDED.source_id,
        capture_id = EXCLUDED.capture_id,
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        confidence = EXCLUDED.confidence,
        extractor_version = EXCLUDED.extractor_version,
        review_state = EXCLUDED.review_state,
        first_seen_at = LEAST(threat_intel.incidents.first_seen_at, EXCLUDED.first_seen_at),
        reported_at = COALESCE(EXCLUDED.reported_at, threat_intel.incidents.reported_at),
        published_at = COALESCE(LEAST(threat_intel.incidents.published_at, EXCLUDED.published_at), threat_intel.incidents.published_at, EXCLUDED.published_at),
        collected_at = EXCLUDED.collected_at,
        processed_at = EXCLUDED.processed_at,
        first_visible_at = EXCLUDED.first_visible_at,
        updated_at = EXCLUDED.updated_at,
        record = EXCLUDED.record
    `;
    const revisionId = stableId("incident-revision", `${incident.id}:${incident.captureId}:${incident.extractorVersion ?? capture?.provenance?.extractorVersion ?? "unknown"}`);
    await sql`
      INSERT INTO threat_intel.incident_revisions (
        id, tenant_id, incident_id, legacy_incident_id, source_id, capture_id,
        title, summary, confidence, extractor_version, review_state, observed_at,
        origin, record
      ) VALUES (
        ${revisionId}, ${nullable(incident.tenantId ?? capture?.tenantId)}, ${incident.id}, NULL,
        ${incident.sourceId ?? capture?.sourceId}, ${incident.captureId}, ${incident.title ?? incident.id},
        ${incident.summary ?? ""}, ${score(incident.confidence)},
        ${incident.extractorVersion ?? capture?.provenance?.extractorVersion ?? "unknown"},
        ${incident.reviewState ?? "unreviewed"}, ${incident.updatedAt ?? capture?.processedAt ?? new Date().toISOString()},
        'runtime', ${toJson({ ...incident, id: revisionId, incidentId: incident.id, captureId: incident.captureId, origin: "runtime" })}::text::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      UPDATE threat_intel.incidents AS current
      SET record = current.record || jsonb_build_object(
        'captureIds', (
          SELECT COALESCE(jsonb_agg(capture_id ORDER BY capture_id), '[]'::jsonb)
          FROM (SELECT DISTINCT capture_id FROM threat_intel.incident_revisions WHERE incident_id = ${incident.id}) AS captures
        ),
        'revisionCount', (SELECT count(*) FROM threat_intel.incident_revisions WHERE incident_id = ${incident.id})
      )
      WHERE current.id = ${incident.id}
    `;
  }

  private async persistEntity(entity: any, sql: any = this.sql): Promise<void> {
    await sql`
      INSERT INTO threat_intel.entities (
        id, tenant_id, source_id, capture_id, incident_id, entity_type, value,
        normalized_value, confidence, extractor_version, provenance, record
      ) VALUES (
        ${entity.id}, ${nullable(entity.tenantId)}, ${entity.sourceId}, ${entity.captureId}, ${nullable(entity.incidentId)},
        ${entity.type}, ${entity.value}, ${entity.normalizedValue ?? entity.value}, ${score(entity.confidence)},
        ${entity.extractorVersion ?? "unknown"}, ${toJson(entity.provenance ?? [])}::text::jsonb, ${toJson(entity)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        incident_id = EXCLUDED.incident_id,
        confidence = EXCLUDED.confidence,
        provenance = EXCLUDED.provenance,
        record = EXCLUDED.record
    `;
  }

  private async persistIndicator(indicator: any, sql: any = this.sql): Promise<void> {
    await sql`
      INSERT INTO threat_intel.indicators (
        id, tenant_id, source_id, capture_id, incident_id, indicator_type, value,
        normalized_value, confidence, extractor_version, provenance, record
      ) VALUES (
        ${indicator.id}, ${nullable(indicator.tenantId)}, ${indicator.sourceId}, ${indicator.captureId}, ${nullable(indicator.incidentId)},
        ${indicator.type}, ${indicator.value}, ${indicator.normalizedValue ?? indicator.value}, ${score(indicator.confidence)},
        ${indicator.extractorVersion ?? "unknown"}, ${toJson(indicator.provenance ?? [])}::text::jsonb, ${toJson(indicator)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        incident_id = EXCLUDED.incident_id,
        confidence = EXCLUDED.confidence,
        provenance = EXCLUDED.provenance,
        record = EXCLUDED.record
    `;
  }

  private async persistActorProfile(profile: any, sql?: any): Promise<void> {
    if (!sql) {
      await this.sql.begin((transaction) => this.persistActorProfile(profile, transaction));
      return;
    }
    const firstSeenAt = profile.firstSeenAt ?? profile.lastSeenAt ?? new Date().toISOString();
    const lastSeenAt = profile.lastSeenAt ?? firstSeenAt;
    await sql`
      INSERT INTO threat_intel.actor_profiles (
        id, tenant_id, canonical_name, normalized_name, actor_type, confidence,
        first_seen_at, last_seen_at, evidence_count, updated_at, record
      ) VALUES (
        ${profile.id}, ${nullable(profile.tenantId)}, ${profile.canonicalName}, ${profile.normalizedName},
        ${profile.actorType ?? "unknown"}, ${score(profile.confidence)}, ${firstSeenAt}, ${lastSeenAt},
        ${Math.max(1, Number(profile.evidenceCount ?? 1))}, ${profile.updatedAt ?? lastSeenAt}, ${toJson(profile)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        canonical_name = EXCLUDED.canonical_name,
        normalized_name = EXCLUDED.normalized_name,
        actor_type = EXCLUDED.actor_type,
        confidence = EXCLUDED.confidence,
        first_seen_at = LEAST(threat_intel.actor_profiles.first_seen_at, EXCLUDED.first_seen_at),
        last_seen_at = GREATEST(threat_intel.actor_profiles.last_seen_at, EXCLUDED.last_seen_at),
        evidence_count = EXCLUDED.evidence_count,
        updated_at = EXCLUDED.updated_at,
        record = EXCLUDED.record
    `;
    await sql`DELETE FROM threat_intel.actor_aliases WHERE actor_profile_id = ${profile.id}`;
    for (const aliasRecord of actorAliasRecords(profile, firstSeenAt, lastSeenAt)) {
      await sql`
        INSERT INTO threat_intel.actor_aliases (
          id, tenant_id, actor_profile_id, alias, normalized_alias, confidence,
          first_seen_at, last_seen_at, evidence_count, updated_at, record
        ) VALUES (
          ${aliasRecord.id}, ${nullable(aliasRecord.tenantId)}, ${aliasRecord.actorProfileId},
          ${aliasRecord.alias}, ${aliasRecord.normalizedAlias}, ${score(aliasRecord.confidence)},
          ${aliasRecord.firstSeenAt}, ${aliasRecord.lastSeenAt}, ${aliasRecord.evidenceCount},
          ${aliasRecord.updatedAt}, ${toJson(aliasRecord)}::text::jsonb
        )
      `;
    }
  }

  private async persistActorProfileArchiveHistory(profileId: string, reconciledAt: string, sql: any): Promise<void> {
    await sql`
      INSERT INTO threat_intel.actor_profile_identity_history (
        id, actor_profile_id, canonical_actor_profile_id, reconciliation_key,
        resolution_status, original_tenant_id, original_record, reference_snapshot, reconciled_at
      )
      SELECT
        'actor-profile-history-' || md5(profile.id),
        profile.id,
        NULL,
        (CASE WHEN profile.tenant_id IS NULL OR profile.tenant_id = 'default' THEN '' ELSE profile.tenant_id END) || ':profile:' || profile.id,
        'inactive_identity',
        profile.tenant_id,
        profile.record,
        jsonb_build_object(
          'aliases', COALESCE((SELECT jsonb_agg(to_jsonb(alias.*) ORDER BY alias.id) FROM threat_intel.actor_aliases alias WHERE alias.actor_profile_id = profile.id), '[]'::jsonb),
          'evidenceLinks', COALESCE((SELECT jsonb_agg(to_jsonb(link) ORDER BY link.id) FROM threat_intel.evidence_links link WHERE link.subject_type = 'actor_profile' AND link.subject_id = profile.id), '[]'::jsonb),
          'claims', COALESCE((SELECT jsonb_agg(to_jsonb(claim) ORDER BY claim.id) FROM threat_intel.intelligence_claims claim WHERE claim.subject_type = 'actor_profile' AND claim.subject_id = profile.id), '[]'::jsonb),
          'claimEvidence', COALESCE((
            SELECT jsonb_agg(to_jsonb(evidence) ORDER BY evidence.id)
            FROM threat_intel.claim_evidence evidence
            WHERE (evidence.subject_type = 'actor_profile' AND evidence.subject_id = profile.id)
              OR evidence.claim_id IN (
                SELECT claim.id
                FROM threat_intel.intelligence_claims claim
                WHERE claim.subject_type = 'actor_profile' AND claim.subject_id = profile.id
              )
          ), '[]'::jsonb),
          'claimReviews', COALESCE((SELECT jsonb_agg(to_jsonb(review) ORDER BY review.id) FROM threat_intel.claim_reviews review JOIN threat_intel.intelligence_claims claim ON claim.id = review.claim_id WHERE claim.subject_type = 'actor_profile' AND claim.subject_id = profile.id), '[]'::jsonb),
          'workflows', COALESCE((SELECT jsonb_agg(to_jsonb(workflow) ORDER BY workflow.record_type, workflow.id) FROM threat_intel.workflow_records workflow WHERE workflow.record->>'subjectType' = 'actor_profile' AND workflow.record->>'subjectId' = profile.id), '[]'::jsonb)
        ),
        ${reconciledAt}
      FROM threat_intel.actor_profiles profile
      WHERE profile.id = ${profileId}
      ON CONFLICT (actor_profile_id) DO NOTHING
    `;
  }

  private async persistCollectionRun(run: any, sql: any = this.sql): Promise<void> {
    const startedAt = run.startedAt ?? run.createdAt ?? run.updatedAt ?? new Date().toISOString();
    const updatedAt = run.updatedAt ?? run.completedAt ?? startedAt;
    await sql`
      INSERT INTO threat_intel.collection_runs (
        id, tenant_id, plan_id, request_id, idempotency_key, status, started_at,
        completed_at, updated_at, task_count, source_count, capture_count,
        incident_count, failed_task_count, error, record
      ) VALUES (
        ${run.id}, ${nullable(run.tenantId)}, ${nullable(run.planId)}, ${nullable(run.requestId)},
        ${nullable(run.idempotencyKey)}, ${run.status ?? "unknown"}, ${startedAt},
        ${nullable(run.completedAt)}, ${updatedAt}, ${count(run.taskCount)}, ${count(run.sourceCount)},
        ${count(run.captureCount)}, ${count(run.incidentCount)}, ${count(run.failedTaskCount)},
        ${nullable(run.error)}, ${toJson(run)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        plan_id = EXCLUDED.plan_id,
        request_id = EXCLUDED.request_id,
        idempotency_key = EXCLUDED.idempotency_key,
        status = EXCLUDED.status,
        started_at = LEAST(threat_intel.collection_runs.started_at, EXCLUDED.started_at),
        completed_at = CASE
          WHEN EXCLUDED.status IN ('queued', 'running') THEN NULL
          ELSE COALESCE(EXCLUDED.completed_at, threat_intel.collection_runs.completed_at)
        END,
        updated_at = EXCLUDED.updated_at,
        task_count = EXCLUDED.task_count,
        source_count = EXCLUDED.source_count,
        capture_count = EXCLUDED.capture_count,
        incident_count = EXCLUDED.incident_count,
        failed_task_count = EXCLUDED.failed_task_count,
        error = EXCLUDED.error,
        record = EXCLUDED.record
    `;
  }

  private async persistSourceHealth(observation: any, sql: any = this.sql): Promise<void> {
    await sql`
      INSERT INTO threat_intel.source_health (
        id, tenant_id, source_id, collection_run_id, checked_at, status, success,
        useful, http_status, latency_ms, item_count, capture_count, incident_count,
        duplicate_count, parser_warning_count, observed_actor_count, freshness_lag_seconds,
        false_positive_rate, adapter_failure_category, failure_reason, legal_mode, record
      ) VALUES (
        ${observation.id}, ${nullable(observation.tenantId)}, ${observation.sourceId},
        ${nullable(observation.collectionRunId)}, ${observation.checkedAt}, ${observation.status},
        ${Boolean(observation.success)}, ${Boolean(observation.useful)}, ${nullable(observation.httpStatus)},
        ${nullableNonNegative(observation.latencyMs)}, ${count(observation.itemCount)}, ${count(observation.captureCount)},
        ${count(observation.incidentCount)}, ${count(observation.duplicateCount)},
        ${count(observation.parserWarningCount)}, ${count(observation.observedActorCount)},
        ${nullableNonNegative(observation.freshnessLagSeconds)}, ${nullableScore(observation.falsePositiveRate)},
        ${nullable(observation.adapterFailureCategory)}, ${nullable(observation.failureReason)},
        ${observation.legalMode}, ${toJson(observation)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        success = EXCLUDED.success,
        useful = EXCLUDED.useful,
        latency_ms = EXCLUDED.latency_ms,
        item_count = EXCLUDED.item_count,
        capture_count = EXCLUDED.capture_count,
        incident_count = EXCLUDED.incident_count,
        duplicate_count = EXCLUDED.duplicate_count,
        parser_warning_count = EXCLUDED.parser_warning_count,
        observed_actor_count = EXCLUDED.observed_actor_count,
        freshness_lag_seconds = EXCLUDED.freshness_lag_seconds,
        adapter_failure_category = EXCLUDED.adapter_failure_category,
        failure_reason = EXCLUDED.failure_reason,
        record = EXCLUDED.record
    `;
  }

  private async persistTimeliness(record: any, sql: any = this.sql): Promise<void> {
    await sql`
      INSERT INTO threat_intel.timeliness_records (
        id, tenant_id, source_id, capture_id, incident_id, reported_at, actor_reported_at,
        victim_reported_at, publisher_reported_at, first_reported_at, first_reported_kind,
        first_reported_provenance, published_at, collected_at, processed_at, first_visible_at,
        alerted_at, alert_created_at, delivery_attempted_at, delivered_at, updated_at, record
      ) VALUES (
        ${record.id}, ${nullable(record.tenantId)}, ${record.sourceId}, ${record.captureId},
        ${record.incidentId}, ${nullable(record.firstReportedAt ?? record.reportedAt)}, ${nullable(record.actorReportedAt)},
        ${nullable(record.victimReportedAt)}, ${nullable(record.publisherReportedAt)}, ${nullable(record.firstReportedAt ?? record.reportedAt)},
        ${nullable(record.firstReportedKind)}, ${record.firstReportedProvenance ? toJson(record.firstReportedProvenance) : null}::text::jsonb,
        ${nullable(record.publishedAt)}, ${record.collectedAt}, ${record.processedAt}, ${record.firstVisibleAt},
        ${nullable(record.alertCreatedAt ?? record.alertedAt)}, ${nullable(record.alertCreatedAt ?? record.alertedAt)},
        ${nullable(record.deliveryAttemptedAt)}, ${nullable(record.deliveredAt)},
        ${record.updatedAt ?? record.firstVisibleAt}, ${toJson(record)}::text::jsonb
      )
      ON CONFLICT (incident_id) DO UPDATE SET
        reported_at = COALESCE(LEAST(threat_intel.timeliness_records.reported_at, EXCLUDED.reported_at), threat_intel.timeliness_records.reported_at, EXCLUDED.reported_at),
        actor_reported_at = COALESCE(LEAST(threat_intel.timeliness_records.actor_reported_at, EXCLUDED.actor_reported_at), threat_intel.timeliness_records.actor_reported_at, EXCLUDED.actor_reported_at),
        victim_reported_at = COALESCE(LEAST(threat_intel.timeliness_records.victim_reported_at, EXCLUDED.victim_reported_at), threat_intel.timeliness_records.victim_reported_at, EXCLUDED.victim_reported_at),
        publisher_reported_at = COALESCE(LEAST(threat_intel.timeliness_records.publisher_reported_at, EXCLUDED.publisher_reported_at), threat_intel.timeliness_records.publisher_reported_at, EXCLUDED.publisher_reported_at),
        first_reported_kind = CASE
          WHEN threat_intel.timeliness_records.first_reported_at IS NULL THEN EXCLUDED.first_reported_kind
          WHEN EXCLUDED.first_reported_at IS NULL THEN threat_intel.timeliness_records.first_reported_kind
          WHEN EXCLUDED.first_reported_at < threat_intel.timeliness_records.first_reported_at THEN EXCLUDED.first_reported_kind
          ELSE threat_intel.timeliness_records.first_reported_kind
        END,
        first_reported_provenance = CASE
          WHEN threat_intel.timeliness_records.first_reported_at IS NULL THEN EXCLUDED.first_reported_provenance
          WHEN EXCLUDED.first_reported_at IS NULL THEN threat_intel.timeliness_records.first_reported_provenance
          WHEN EXCLUDED.first_reported_at < threat_intel.timeliness_records.first_reported_at THEN EXCLUDED.first_reported_provenance
          ELSE threat_intel.timeliness_records.first_reported_provenance
        END,
        first_reported_at = COALESCE(LEAST(threat_intel.timeliness_records.first_reported_at, EXCLUDED.first_reported_at), threat_intel.timeliness_records.first_reported_at, EXCLUDED.first_reported_at),
        published_at = COALESCE(EXCLUDED.published_at, threat_intel.timeliness_records.published_at),
        collected_at = LEAST(threat_intel.timeliness_records.collected_at, EXCLUDED.collected_at),
        processed_at = LEAST(threat_intel.timeliness_records.processed_at, EXCLUDED.processed_at),
        first_visible_at = LEAST(threat_intel.timeliness_records.first_visible_at, EXCLUDED.first_visible_at),
        alerted_at = CASE
          WHEN threat_intel.timeliness_records.alerted_at IS NULL THEN EXCLUDED.alerted_at
          WHEN EXCLUDED.alerted_at IS NULL THEN threat_intel.timeliness_records.alerted_at
          ELSE LEAST(threat_intel.timeliness_records.alerted_at, EXCLUDED.alerted_at)
        END,
        alert_created_at = COALESCE(LEAST(threat_intel.timeliness_records.alert_created_at, EXCLUDED.alert_created_at), threat_intel.timeliness_records.alert_created_at, EXCLUDED.alert_created_at),
        delivery_attempted_at = COALESCE(LEAST(threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at), threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at),
        delivered_at = COALESCE(LEAST(threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at), threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at),
        updated_at = EXCLUDED.updated_at,
        record = ((threat_intel.timeliness_records.record || EXCLUDED.record)
          - 'alertCreatedAt' - 'alertedAt' - 'alertCreatedProvenance'
          - 'deliveryAttemptedAt' - 'deliveryAttemptProvenance'
          - 'deliveredAt' - 'deliveredProvenance' - 'latencies')
          || jsonb_strip_nulls(jsonb_build_object(
            'alertCreatedAt', CASE
              WHEN threat_intel.timeliness_records.alert_created_at IS NULL THEN EXCLUDED.record->'alertCreatedAt'
              WHEN EXCLUDED.alert_created_at IS NULL OR threat_intel.timeliness_records.alert_created_at <= EXCLUDED.alert_created_at
                THEN COALESCE(threat_intel.timeliness_records.record->'alertCreatedAt', to_jsonb(threat_intel.timeliness_records.alert_created_at))
              ELSE COALESCE(EXCLUDED.record->'alertCreatedAt', to_jsonb(EXCLUDED.alert_created_at))
            END,
            'alertedAt', CASE
              WHEN threat_intel.timeliness_records.alert_created_at IS NULL THEN COALESCE(EXCLUDED.record->'alertedAt', EXCLUDED.record->'alertCreatedAt')
              WHEN EXCLUDED.alert_created_at IS NULL OR threat_intel.timeliness_records.alert_created_at <= EXCLUDED.alert_created_at
                THEN COALESCE(threat_intel.timeliness_records.record->'alertedAt', threat_intel.timeliness_records.record->'alertCreatedAt', to_jsonb(threat_intel.timeliness_records.alert_created_at))
              ELSE COALESCE(EXCLUDED.record->'alertedAt', EXCLUDED.record->'alertCreatedAt', to_jsonb(EXCLUDED.alert_created_at))
            END,
            'alertCreatedProvenance', CASE
              WHEN threat_intel.timeliness_records.alert_created_at IS NULL THEN EXCLUDED.record->'alertCreatedProvenance'
              WHEN EXCLUDED.alert_created_at IS NULL OR threat_intel.timeliness_records.alert_created_at <= EXCLUDED.alert_created_at
                THEN COALESCE(threat_intel.timeliness_records.record->'alertCreatedProvenance', EXCLUDED.record->'alertCreatedProvenance')
              ELSE COALESCE(EXCLUDED.record->'alertCreatedProvenance', threat_intel.timeliness_records.record->'alertCreatedProvenance')
            END,
            'deliveryAttemptedAt', CASE
              WHEN threat_intel.timeliness_records.delivery_attempted_at IS NULL THEN EXCLUDED.record->'deliveryAttemptedAt'
              WHEN EXCLUDED.delivery_attempted_at IS NULL OR threat_intel.timeliness_records.delivery_attempted_at <= EXCLUDED.delivery_attempted_at
                THEN COALESCE(threat_intel.timeliness_records.record->'deliveryAttemptedAt', to_jsonb(threat_intel.timeliness_records.delivery_attempted_at))
              ELSE COALESCE(EXCLUDED.record->'deliveryAttemptedAt', to_jsonb(EXCLUDED.delivery_attempted_at))
            END,
            'deliveryAttemptProvenance', CASE
              WHEN threat_intel.timeliness_records.delivery_attempted_at IS NULL THEN EXCLUDED.record->'deliveryAttemptProvenance'
              WHEN EXCLUDED.delivery_attempted_at IS NULL OR threat_intel.timeliness_records.delivery_attempted_at <= EXCLUDED.delivery_attempted_at
                THEN COALESCE(threat_intel.timeliness_records.record->'deliveryAttemptProvenance', EXCLUDED.record->'deliveryAttemptProvenance')
              ELSE COALESCE(EXCLUDED.record->'deliveryAttemptProvenance', threat_intel.timeliness_records.record->'deliveryAttemptProvenance')
            END,
            'deliveredAt', CASE
              WHEN threat_intel.timeliness_records.delivered_at IS NULL THEN EXCLUDED.record->'deliveredAt'
              WHEN EXCLUDED.delivered_at IS NULL OR threat_intel.timeliness_records.delivered_at <= EXCLUDED.delivered_at
                THEN COALESCE(threat_intel.timeliness_records.record->'deliveredAt', to_jsonb(threat_intel.timeliness_records.delivered_at))
              ELSE COALESCE(EXCLUDED.record->'deliveredAt', to_jsonb(EXCLUDED.delivered_at))
            END,
            'deliveredProvenance', CASE
              WHEN threat_intel.timeliness_records.delivered_at IS NULL THEN EXCLUDED.record->'deliveredProvenance'
              WHEN EXCLUDED.delivered_at IS NULL OR threat_intel.timeliness_records.delivered_at <= EXCLUDED.delivered_at
                THEN COALESCE(threat_intel.timeliness_records.record->'deliveredProvenance', EXCLUDED.record->'deliveredProvenance')
              ELSE COALESCE(EXCLUDED.record->'deliveredProvenance', threat_intel.timeliness_records.record->'deliveredProvenance')
            END,
            'latencies', ((COALESCE(threat_intel.timeliness_records.record->'latencies', '{}'::jsonb) || COALESCE(EXCLUDED.record->'latencies', '{}'::jsonb))
              - 'alertToDeliveryAttemptSeconds' - 'deliveryAttemptToDeliveredSeconds' - 'reportToDeliveredSeconds')
              || jsonb_strip_nulls(jsonb_build_object(
                'alertToDeliveryAttemptSeconds', CASE
                  WHEN COALESCE(LEAST(threat_intel.timeliness_records.alert_created_at, EXCLUDED.alert_created_at), threat_intel.timeliness_records.alert_created_at, EXCLUDED.alert_created_at) IS NOT NULL
                   AND COALESCE(LEAST(threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at), threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at) IS NOT NULL
                    THEN round(extract(epoch FROM
                      COALESCE(LEAST(threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at), threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at)
                      - COALESCE(LEAST(threat_intel.timeliness_records.alert_created_at, EXCLUDED.alert_created_at), threat_intel.timeliness_records.alert_created_at, EXCLUDED.alert_created_at)
                    ))::bigint
                END,
                'deliveryAttemptToDeliveredSeconds', CASE
                  WHEN COALESCE(LEAST(threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at), threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at) IS NOT NULL
                   AND COALESCE(LEAST(threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at), threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at) IS NOT NULL
                    THEN round(extract(epoch FROM
                      COALESCE(LEAST(threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at), threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at)
                      - COALESCE(LEAST(threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at), threat_intel.timeliness_records.delivery_attempted_at, EXCLUDED.delivery_attempted_at)
                    ))::bigint
                END,
                'reportToDeliveredSeconds', CASE
                  WHEN COALESCE(LEAST(threat_intel.timeliness_records.first_reported_at, EXCLUDED.first_reported_at), threat_intel.timeliness_records.first_reported_at, EXCLUDED.first_reported_at) IS NOT NULL
                   AND COALESCE(LEAST(threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at), threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at) IS NOT NULL
                    THEN round(extract(epoch FROM
                      COALESCE(LEAST(threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at), threat_intel.timeliness_records.delivered_at, EXCLUDED.delivered_at)
                      - COALESCE(LEAST(threat_intel.timeliness_records.first_reported_at, EXCLUDED.first_reported_at), threat_intel.timeliness_records.first_reported_at, EXCLUDED.first_reported_at)
                    ))::bigint
                END
              ))
          ))
    `;
  }

  private async persistIntelligenceClaim(claim: any, sql: any = this.sql): Promise<void> {
    await sql`
      INSERT INTO threat_intel.intelligence_claims (
        id, tenant_id, claim_type, subject_type, subject_id, claim_value, summary,
        confidence, evidence_stage, extraction_method, extractor_version, review_state,
        corroboration_state, source_count, evidence_count, first_seen_at, last_seen_at,
        stale_after, reviewed_by, reviewed_at, contradiction_reason, legal_hold,
        retention_class, created_at, updated_at, record
      ) VALUES (
        ${claim.id}, ${nullable(claim.tenantId)}, ${claim.claimType}, ${claim.subjectType}, ${claim.subjectId},
        ${toJson(claim.value ?? {})}::text::jsonb, ${String(claim.summary ?? "").slice(0, 500)},
        ${score(claim.confidence)}, ${claim.evidenceStage}, ${claim.extractionMethod},
        ${nullable(claim.extractorVersion)}, ${claim.reviewState}, ${claim.corroborationState},
        ${Math.max(1, count(claim.sourceCount))}, ${Math.max(1, count(claim.evidenceCount))},
        ${claim.firstSeenAt}, ${claim.lastSeenAt}, ${nullable(claim.staleAfter)},
        ${nullable(claim.reviewedBy)}, ${nullable(claim.reviewedAt)}, ${nullable(claim.contradictionReason)},
        ${Boolean(claim.legalHold)}, ${claim.retentionClass ?? "standard"},
        ${claim.createdAt ?? claim.firstSeenAt}, ${claim.updatedAt ?? claim.lastSeenAt}, ${toJson(claim)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        subject_type = EXCLUDED.subject_type,
        subject_id = EXCLUDED.subject_id,
        claim_value = EXCLUDED.claim_value,
        summary = EXCLUDED.summary,
        confidence = EXCLUDED.confidence,
        evidence_stage = EXCLUDED.evidence_stage,
        extraction_method = EXCLUDED.extraction_method,
        extractor_version = EXCLUDED.extractor_version,
        review_state = EXCLUDED.review_state,
        corroboration_state = EXCLUDED.corroboration_state,
        source_count = EXCLUDED.source_count,
        evidence_count = EXCLUDED.evidence_count,
        first_seen_at = LEAST(threat_intel.intelligence_claims.first_seen_at, EXCLUDED.first_seen_at),
        last_seen_at = GREATEST(threat_intel.intelligence_claims.last_seen_at, EXCLUDED.last_seen_at),
        stale_after = EXCLUDED.stale_after,
        reviewed_by = EXCLUDED.reviewed_by,
        reviewed_at = EXCLUDED.reviewed_at,
        contradiction_reason = EXCLUDED.contradiction_reason,
        legal_hold = EXCLUDED.legal_hold,
        retention_class = EXCLUDED.retention_class,
        updated_at = EXCLUDED.updated_at,
        record = EXCLUDED.record
    `;
  }

  private async persistClaimEvidence(evidence: any, sql: any = this.sql): Promise<void> {
    await sql`
      INSERT INTO threat_intel.claim_evidence (
        id, tenant_id, claim_id, capture_id, source_id, subject_type, subject_id,
        relationship, evidence_stage, confidence, extractor_version, provenance, created_at, record
      ) VALUES (
        ${evidence.id}, ${nullable(evidence.tenantId)}, ${evidence.claimId}, ${evidence.captureId},
        ${evidence.sourceId}, ${evidence.subjectType}, ${evidence.subjectId}, ${evidence.relationship},
        ${evidence.evidenceStage}, ${score(evidence.confidence)}, ${nullable(evidence.extractorVersion)},
        ${toJson(evidence.provenance ?? {})}::text::jsonb, ${evidence.createdAt ?? new Date().toISOString()},
        ${toJson(evidence)}::text::jsonb
      )
      ON CONFLICT (claim_id, capture_id, subject_type, subject_id, relationship) DO UPDATE SET
        relationship = EXCLUDED.relationship,
        evidence_stage = EXCLUDED.evidence_stage,
        confidence = GREATEST(threat_intel.claim_evidence.confidence, EXCLUDED.confidence),
        extractor_version = COALESCE(EXCLUDED.extractor_version, threat_intel.claim_evidence.extractor_version),
        provenance = EXCLUDED.provenance,
        record = EXCLUDED.record || jsonb_build_object('id', threat_intel.claim_evidence.id)
    `;
  }

  private async persistClaimReview(review: any, claim: any): Promise<void> {
    await this.sql.begin(async (sql) => {
      await this.persistIntelligenceClaim(claim, sql);
      await sql`
        INSERT INTO threat_intel.claim_reviews (
          id, tenant_id, claim_id, action, previous_state, next_state,
          reviewer_id, reason, reviewed_at, record
        ) VALUES (
          ${review.id}, ${nullable(review.tenantId ?? claim.tenantId)}, ${review.claimId}, ${review.action},
          ${review.previousState}, ${review.nextState}, ${review.reviewerId}, ${review.reason},
          ${review.reviewedAt}, ${toJson(review)}::text::jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `;
    });
  }

  private async persistAnalystClaim(claimId: string): Promise<void> {
    const claim = this.getIntelligenceClaim(claimId);
    if (!claim) throw new Error(`Analyst claim was not materialized: ${claimId}`);
    const evidence = this.listClaimEvidence().filter((record: any) => record.claimId === claimId);
    const links = this.listEvidenceLinks().filter((record: any) => record.subjectType === "claim" && record.subjectId === claimId);
    await this.sql.begin(async (sql) => {
      await this.persistIntelligenceClaim(claim, sql);
      for (const record of evidence) await this.persistClaimEvidence(record, sql);
      for (const record of links) await this.persistEvidenceLink(record, sql);
    });
  }

  private async persistEvidenceLink(linkRecord: any, sql: any = this.sql): Promise<void> {
    await sql`
      INSERT INTO threat_intel.evidence_links (
        id, tenant_id, capture_id, subject_type, subject_id, relationship,
        confidence, extractor_version, created_at, record
      ) VALUES (
        ${linkRecord.id}, ${nullable(linkRecord.tenantId)}, ${linkRecord.captureId}, ${linkRecord.subjectType},
        ${linkRecord.subjectId}, ${linkRecord.relationship}, ${score(linkRecord.confidence)},
        ${nullable(linkRecord.extractorVersion)}, ${linkRecord.createdAt ?? new Date().toISOString()}, ${toJson(linkRecord)}::text::jsonb
      )
      ON CONFLICT (capture_id, subject_type, subject_id, relationship) DO UPDATE SET
        confidence = GREATEST(threat_intel.evidence_links.confidence, EXCLUDED.confidence),
        extractor_version = COALESCE(EXCLUDED.extractor_version, threat_intel.evidence_links.extractor_version),
        record = EXCLUDED.record || jsonb_build_object('id', threat_intel.evidence_links.id)
    `;
  }

  private async persistValidationRecord(record: EvaluationValidationRecord): Promise<void> {
    await this.sql`
      INSERT INTO threat_intel.validation_records (
        id, tenant_id, capture_id, incident_id, claim_id, validation_type, status, reference_url,
        reference_published_at, matched_at, reviewer_id, notes, updated_at, record
      ) VALUES (
        ${record.id}, ${nullable(record.tenantId)}, ${nullable(record.captureId)}, ${nullable(record.incidentId)},
        ${nullable(record.claimId)}, ${record.validationType}, ${record.status}, ${record.referenceUrl}, ${nullable(record.referencePublishedAt)},
        ${record.matchedAt}, ${nullable(record.reviewerId)}, ${nullable(record.notes)},
        ${record.updatedAt ?? record.matchedAt}, ${toJson(record)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        reference_url = EXCLUDED.reference_url,
        reference_published_at = EXCLUDED.reference_published_at,
        claim_id = EXCLUDED.claim_id,
        matched_at = EXCLUDED.matched_at,
        reviewer_id = EXCLUDED.reviewer_id,
        notes = EXCLUDED.notes,
        updated_at = EXCLUDED.updated_at,
        record = EXCLUDED.record
    `;
  }

  private async persistAlert(alert: any): Promise<void> {
    const firstSeenAt = alert.firstSeenAt ?? alert.savedAt ?? alert.updatedAt ?? new Date().toISOString();
    const lastSeenAt = alert.lastSeenAt ?? firstSeenAt;
    const captureId = alert.captureId && this.getCapture(alert.captureId) ? alert.captureId : null;
    const incidentId = alert.incidentId && this.getIncident(alert.incidentId) ? alert.incidentId : null;
    const alertedAt = alert.alertedAt ?? alert.deliveredAt ?? (alert.deliveryState === "delivered" ? alert.updatedAt : null);
    await this.sql`
      INSERT INTO threat_intel.alerts (
        id, tenant_id, organization_id, incident_id, capture_id, dedupe_key, severity,
        confidence, review_state, delivery_state, first_seen_at, last_seen_at, alerted_at, updated_at, record
      ) VALUES (
        ${alert.id}, ${alert.tenantId ?? "default"}, ${nullable(alert.organizationId)}, ${incidentId}, ${captureId},
        ${alert.dedupeKey ?? stableId("alert-dedupe", alert.id)}, ${alert.severity ?? "medium"},
        ${alertScore(alert.confidence)}, ${alert.reviewState ?? "unreviewed"}, ${alert.deliveryState ?? "pending_review"},
        ${firstSeenAt}, ${lastSeenAt}, ${alertedAt}, ${alert.updatedAt ?? lastSeenAt}, ${toJson(alert)}::text::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        incident_id = EXCLUDED.incident_id,
        capture_id = EXCLUDED.capture_id,
        severity = EXCLUDED.severity,
        confidence = EXCLUDED.confidence,
        review_state = EXCLUDED.review_state,
        delivery_state = EXCLUDED.delivery_state,
        first_seen_at = CASE
          WHEN threat_intel.alerts.first_seen_at IS NULL THEN EXCLUDED.first_seen_at
          WHEN EXCLUDED.first_seen_at IS NULL THEN threat_intel.alerts.first_seen_at
          ELSE LEAST(threat_intel.alerts.first_seen_at, EXCLUDED.first_seen_at)
        END,
        last_seen_at = EXCLUDED.last_seen_at,
        alerted_at = COALESCE(threat_intel.alerts.alerted_at, EXCLUDED.alerted_at),
        updated_at = EXCLUDED.updated_at,
        record = jsonb_set(
          EXCLUDED.record,
          '{firstSeenAt}',
          to_jsonb((CASE
            WHEN threat_intel.alerts.first_seen_at IS NULL THEN EXCLUDED.first_seen_at
            WHEN EXCLUDED.first_seen_at IS NULL THEN threat_intel.alerts.first_seen_at
            ELSE LEAST(threat_intel.alerts.first_seen_at, EXCLUDED.first_seen_at)
          END)::text),
          true
        )
    `;
  }

  private async persistEvaluationLabel(label: EvaluationLabelRecord): Promise<void> {
    await this.sql`
      INSERT INTO threat_intel.evaluation_labels (
        id, tenant_id, capture_id, incident_id, entity_id, indicator_id, claim_id, label_type,
        expected_value, observed_value, outcome, dataset_split, labeled_by, labeled_at,
        notes, updated_at, record
      ) VALUES (
        ${label.id}, ${nullable(label.tenantId)}, ${nullable(label.captureId)}, ${nullable(label.incidentId)},
        ${nullable(label.entityId)}, ${nullable(label.indicatorId)}, ${nullable(label.claimId)}, ${label.labelType},
        ${label.expectedValue === undefined ? null : toJson(label.expectedValue)}::text::jsonb,
        ${label.observedValue === undefined ? null : toJson(label.observedValue)}::text::jsonb,
        ${label.outcome}, ${label.datasetSplit ?? "unassigned"}, ${label.labeledBy}, ${label.labeledAt},
        ${nullable(label.notes)}, ${label.updatedAt ?? label.labeledAt}, ${toJson(label)}::text::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  private async persistWorkflow(recordType: string, record: any, sql: any = this.sql): Promise<void> {
    const createdAt = record.createdAt ?? record.requestedAt ?? record.observedAt ?? record.capturedAt ?? record.savedAt ?? new Date().toISOString();
    const updatedAt = record.updatedAt ?? record.completedAt ?? record.observedAt ?? record.capturedAt ?? createdAt;
    await sql`
      INSERT INTO threat_intel.workflow_records (record_type, id, tenant_id, created_at, updated_at, record)
      VALUES (${recordType}, ${record.id}, ${nullable(record.tenantId)}, ${createdAt}, ${updatedAt}, ${toJson(record)}::text::jsonb)
      ON CONFLICT (record_type, id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        updated_at = EXCLUDED.updated_at,
        record = EXCLUDED.record
    `;
  }

  private async persistPrivacyRedaction(recordType: string, record: any): Promise<void> {
    const json = toJson(record);
    const id = record.id;
    const required = (rows: any[]) => {
      if (!rows.length) throw new Error(`Stored ${recordType} disappeared before PostgreSQL privacy redaction: ${id}`);
    };
    if (recordType === "source") required(await this.sql`UPDATE threat_intel.sources SET name = 'Deleted source', url = ${`privacy://deleted/${id}`}, status = 'retired', record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
    else if (recordType === "capture") required(await this.sql`UPDATE threat_intel.captures SET url = ${`privacy://deleted/${id}`}, canonical_url = ${`privacy://deleted/${id}`}, body = NULL, object_ref = NULL, storage_kind = 'metadata_only', record = ${json}::text::jsonb WHERE id = ${id} RETURNING id`);
    else if (recordType === "incident") await this.sql.begin(async sql => {
      required(await sql`UPDATE threat_intel.incidents SET title = 'Deleted incident', summary = '', record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
      await sql`UPDATE threat_intel.incident_revisions SET title = 'Deleted incident', summary = '', record = ${json}::text::jsonb WHERE incident_id = ${id}`;
      await sql`UPDATE threat_intel.incident_identity_history SET identity_subject = NULL, old_incident = ${json}::text::jsonb, reference_snapshot = '{}'::jsonb, reversed_by = NULL, reversal_reason = NULL, record = ${json}::text::jsonb WHERE old_incident_id = ${id} OR canonical_incident_id = ${id}`;
    });
    else if (recordType === "entity") required(await this.sql`UPDATE threat_intel.entities SET value = ${`deleted:${id}`}, normalized_value = ${`deleted:${id}`}, provenance = '{}'::jsonb, record = ${json}::text::jsonb WHERE id = ${id} RETURNING id`);
    else if (recordType === "indicator") required(await this.sql`UPDATE threat_intel.indicators SET value = ${`deleted:${id}`}, normalized_value = ${`deleted:${id}`}, provenance = '{}'::jsonb, record = ${json}::text::jsonb WHERE id = ${id} RETURNING id`);
    else if (recordType === "actor_profile") required(await this.sql`UPDATE threat_intel.actor_profiles SET canonical_name = ${`Deleted actor ${id}`}, normalized_name = ${`deleted:${id}`}, record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
    else if (recordType === "actor_alias") required(await this.sql`UPDATE threat_intel.actor_aliases SET alias = ${`Deleted alias ${id}`}, normalized_alias = ${`deleted:${id}`}, record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
    else if (recordType === "actor_identity_catalog") await this.sql.begin(async sql => {
      required(await sql`UPDATE threat_intel.actor_identity_catalogs SET record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
      await sql`UPDATE threat_intel.actor_identity_catalog_versions SET record = ${json}::text::jsonb WHERE catalog_id = ${id}`;
    });
    else if (recordType === "actor_identity") await this.sql.begin(async sql => {
      required(await sql`UPDATE threat_intel.actor_identities SET canonical_name = ${`Deleted actor ${id}`}, normalized_name = ${`deleted:${id}`}, record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
      await sql`UPDATE threat_intel.actor_identity_aliases SET label = ${`Deleted alias ${id}`}, normalized_label = ${`deleted:${id}`} || ':' || id, record = ${json}::text::jsonb, updated_at = now() WHERE actor_identity_id = ${id}`;
    });
    else if (recordType === "evidence_link") required(await this.sql`UPDATE threat_intel.evidence_links SET record = ${json}::text::jsonb WHERE id = ${id} RETURNING id`);
    else if (recordType === "validation_record") required(await this.sql`UPDATE threat_intel.validation_records SET reference_url = ${`about:blank#${id}`}, reviewer_id = NULL, notes = NULL, record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
    else if (recordType === "evaluation_label") required(await this.sql`UPDATE threat_intel.evaluation_labels SET expected_value = NULL, observed_value = NULL, labeled_by = 'deleted', notes = NULL, record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
    else if (recordType === "collection_run") required(await this.sql`UPDATE threat_intel.collection_runs SET request_id = NULL, idempotency_key = NULL, error = NULL, record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
    else if (recordType === "source_health") required(await this.sql`UPDATE threat_intel.source_health SET failure_reason = NULL, record = ${json}::text::jsonb WHERE id = ${id} RETURNING id`);
    else if (recordType === "timeliness_record") required(await this.sql`UPDATE threat_intel.timeliness_records SET first_reported_provenance = NULL, record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
    else if (recordType === "intelligence_claim") required(await this.sql`UPDATE threat_intel.intelligence_claims SET claim_value = '{}'::jsonb, summary = '', reviewed_by = NULL, contradiction_reason = NULL, record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
    else if (recordType === "claim_evidence") required(await this.sql`UPDATE threat_intel.claim_evidence SET provenance = '{}'::jsonb, record = ${json}::text::jsonb WHERE id = ${id} RETURNING id`);
    else if (recordType === "claim_review") required(await this.sql`UPDATE threat_intel.claim_reviews SET reviewer_id = 'deleted', reason = 'Privacy redacted', record = ${json}::text::jsonb WHERE id = ${id} RETURNING id`);
    else if (recordType === "alert") required(await this.sql`UPDATE threat_intel.alerts SET dedupe_key = ${`privacy:${id}`}, record = ${json}::text::jsonb, updated_at = now() WHERE id = ${id} RETURNING id`);
    else await this.persistWorkflow(recordType, record);
  }
}

const legacyWorkflowLoaders: Array<[
  snapshotKey: string,
  recordType: string,
  save: (store: InMemoryScraperStore, record: any) => any,
  list: (store: InMemoryScraperStore) => any[]
]> = [
  ["plans", "collection_plan", (store, record) => store.savePlan(record), (store) => store.listPlans()],
  ["runs", "collection_run", (store, record) => store.saveRun(record), (store) => store.listRuns()],
  ["replayJobs", "replay_job", (store, record) => store.saveReplayJob(record), (store) => store.listReplayJobs()],
  ["discoveryEvidence", "discovery_evidence", (store, record) => store.saveDiscoveryEvidence(record), (store) => store.listDiscoveryEvidence()],
  ["liveSearchSnapshots", "live_search_snapshot", (store, record) => store.saveLiveSearchSnapshot(record), (store) => store.listLiveSearchSnapshots()],
  ["evidenceDeltas", "evidence_delta", (store, record) => store.saveEvidenceDelta(record), (store) => store.listEvidenceDeltas()],
  ["analystMetadataReviewTasks", "analyst_metadata_review_task", (store, record) => store.saveAnalystMetadataReviewTask(record), (store) => store.listAnalystMetadataReviewTasks()],
  ["analystSourceActivationPackets", "analyst_source_activation_packet", (store, record) => store.saveAnalystSourceActivationPacket(record), (store) => store.listAnalystSourceActivationPackets()],
  ["analystVictimNotificationPackets", "analyst_victim_notification_packet", (store, record) => store.saveAnalystVictimNotificationPacket(record), (store) => store.listAnalystVictimNotificationPackets()],
  ["analystClaimLedgerEntries", "analyst_claim_ledger_entry", (store, record) => store.saveAnalystClaimLedgerEntry(record), (store) => store.listAnalystClaimLedgerEntries()],
  ["analystLoopSnapshots", "analyst_loop_snapshot", (store, record) => store.saveAnalystLoopSnapshot(record), (store) => store.listAnalystLoopSnapshots()],
  ["evaluationBenchmarks", "evaluation_benchmark", (store, record) => store.saveEvaluationBenchmark(record), (store) => store.listEvaluationBenchmarks()],
  ["evaluationAnnotations", "evaluation_annotation", (store, record) => store.saveEvaluationAnnotation(record), (store) => store.listEvaluationAnnotations()],
  ["evaluationAdjudications", "evaluation_adjudication", (store, record) => store.saveEvaluationAdjudication(record), (store) => store.listEvaluationAdjudications()],
  ["organizations", "organization", (store, record) => store.saveOrganization(record), (store) => store.listOrganizations()],
  ["organizationMembers", "organization_member", (store, record) => store.saveOrganizationMember(record), (store) => store.listOrganizationMembers()],
  ["organizationInvites", "organization_invite", (store, record) => store.saveOrganizationInvite(record), (store) => store.listOrganizationInvites()],
  ["webhookDestinations", "webhook_destination", (store, record) => store.saveWebhookDestination(record), (store) => store.listWebhookDestinations()],
  ["cases", "case", (store, record) => store.saveCase(record), (store) => store.listCases()],
  ["dwmWatchlists", "dwm_watchlist", (store, record) => store.saveDwmWatchlist(record), (store) => store.listDwmWatchlists()],
  ["dwmAlerts", "alert", (store, record) => store.saveDwmAlert(record), (store) => store.listDwmAlerts()],
  ["dwmWebhookDeliveries", "dwm_webhook_delivery", (store, record) => store.saveDwmWebhookDelivery(record), (store) => store.listDwmWebhookDeliveries()],
  ["actorOrgRelevanceReviews", "actor_org_relevance_review", (store, record) => store.saveActorOrgRelevanceReview(record), (store) => store.listActorOrgRelevanceReviews()]
];

const structuredTables = {
  sources: { name: "sources", orderBy: "updated_at", searchBy: "concat_ws(' ', id, name, source_type, status)" },
  captures: { name: "captures", orderBy: "collected_at", searchBy: "concat_ws(' ', id, source_id, content_hash, media_type)" },
  entities: { name: "entities", orderBy: "created_at" },
  indicators: { name: "indicators", orderBy: "created_at" },
  incidents: { name: "incidents", orderBy: "first_seen_at" },
  actorProfiles: { name: "actor_profiles", orderBy: "last_seen_at", where: "COALESCE(record->>'identityResolutionState', 'active') <> 'archived'" },
  actorAliases: { name: "actor_aliases", orderBy: "last_seen_at", where: "EXISTS (SELECT 1 FROM threat_intel.actor_profiles profile WHERE profile.id = actor_profile_id AND COALESCE(profile.record->>'identityResolutionState', 'active') <> 'archived')" },
  actorIdentityCatalogs: { name: "actor_identity_catalogs", orderBy: "retrieved_at", includeGlobal: true },
  actorIdentities: { name: "actor_identities", orderBy: "updated_at", includeGlobal: true },
  evidenceLinks: { name: "evidence_links", orderBy: "created_at" },
  validationRecords: { name: "validation_records", orderBy: "matched_at" },
  evaluationLabels: { name: "evaluation_labels", orderBy: "labeled_at" },
  collectionRuns: { name: "collection_runs", orderBy: "started_at" },
  sourceHealth: { name: "source_health", orderBy: "checked_at" },
  timeliness: { name: "timeliness_records", orderBy: "first_visible_at" },
  claims: { name: "intelligence_claims", orderBy: "last_seen_at" },
  claimEvidence: { name: "claim_evidence", orderBy: "created_at" },
  claimReviews: { name: "claim_reviews", orderBy: "reviewed_at" },
  alerts: { name: "alerts", orderBy: "updated_at", searchBy: "concat_ws(' ', id, incident_id, severity, review_state, delivery_state)" }
} as const;

function readRecord(row: any): any {
  if (typeof row.record === "string") return JSON.parse(row.record);
  return row.record;
}

function sourceReviewEvidenceMatchesSql(source: string) {
  const review = `${source}.record->'metadata'->'automaticSourceReview'`;
  return `(CASE
    WHEN ${source}.record->'metadata'->'sourcePortfolioVerification' IS NULL
      AND ${source}.record->'metadata'->'sourceFeedDiscovery' IS NULL THEN TRUE
    WHEN jsonb_typeof(${review}->'selectedEvidenceIds') IS DISTINCT FROM 'array'
      OR jsonb_typeof(${review}->'selectedEvidenceProvenance') IS DISTINCT FROM 'array' THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(${review}->'selectedEvidenceProvenance') binding
      WHERE COALESCE(binding->>'evidenceId', '') !~ '^[A-Za-z0-9_.:-]{1,200}$'
        OR COALESCE(binding->>'sourceId', '') <> ${source}.id
        OR COALESCE(binding->>'tenantKey', '') <> COALESCE(${source}.tenant_id, 'global')
        OR COALESCE(binding->>'captureId', '') !~ '^[A-Za-z0-9_.:-]{1,200}$'
        OR COALESCE(binding->>'contentHash', '') !~ '^[A-Za-z0-9_.:-]{1,200}$'
        OR COALESCE(binding->>'captureStateSha256', '') !~ '^[a-f0-9]{64}$'
        OR binding->>'evidenceId' <> 'automatic-source-review-evidence_' || substr(encode(sha256(convert_to(binding->>'captureId', 'UTF8')), 'hex'), 1, 16)
        OR NOT (${review}->'selectedEvidenceIds' ? (binding->>'evidenceId'))
        OR NOT EXISTS (
          SELECT 1
          FROM threat_intel.captures bound_capture
          WHERE bound_capture.id = binding->>'captureId'
            AND bound_capture.source_id = ${source}.id
            AND bound_capture.tenant_id IS NOT DISTINCT FROM ${source}.tenant_id
            AND bound_capture.content_hash = binding->>'contentHash'
            AND binding->>'captureStateSha256' = encode(sha256(convert_to(concat_ws('|',
              octet_length(COALESCE(bound_capture.record->>'sourceId', ''))::text || ':' || COALESCE(bound_capture.record->>'sourceId', ''),
              octet_length(COALESCE(bound_capture.record->>'tenantId', 'global'))::text || ':' || COALESCE(bound_capture.record->>'tenantId', 'global'),
              octet_length(COALESCE(bound_capture.record->>'contentHash', ''))::text || ':' || COALESCE(bound_capture.record->>'contentHash', ''),
              octet_length(COALESCE(bound_capture.record->>'body', ''))::text || ':' || COALESCE(bound_capture.record->>'body', ''),
              octet_length(COALESCE(bound_capture.record->>'sensitive', ''))::text || ':' || COALESCE(bound_capture.record->>'sensitive', ''),
              octet_length(COALESCE(bound_capture.record->>'publishedAt', ''))::text || ':' || COALESCE(bound_capture.record->>'publishedAt', ''),
              octet_length(COALESCE(bound_capture.record->>'collectedAt', ''))::text || ':' || COALESCE(bound_capture.record->>'collectedAt', ''),
              octet_length(COALESCE(bound_capture.record->>'storageKind', ''))::text || ':' || COALESCE(bound_capture.record->>'storageKind', ''),
              octet_length(COALESCE(bound_capture.record#>>'{provenance,extractorVersion}', bound_capture.record->>'extractorVersion', ''))::text || ':' || COALESCE(bound_capture.record#>>'{provenance,extractorVersion}', bound_capture.record->>'extractorVersion', ''),
              octet_length(COALESCE(bound_capture.record#>>'{metadata,safeExcerpt}', ''))::text || ':' || COALESCE(bound_capture.record#>>'{metadata,safeExcerpt}', ''),
              octet_length(COALESCE(bound_capture.record#>>'{metadata,leakSite,summary}', ''))::text || ':' || COALESCE(bound_capture.record#>>'{metadata,leakSite,summary}', ''),
              octet_length(COALESCE(bound_capture.record#>>'{metadata,title}', ''))::text || ':' || COALESCE(bound_capture.record#>>'{metadata,title}', ''),
              octet_length(COALESCE(bound_capture.record#>>'{provenance,parserVersion}', bound_capture.record#>>'{metadata,parserVersion}', ''))::text || ':' || COALESCE(bound_capture.record#>>'{provenance,parserVersion}', bound_capture.record#>>'{metadata,parserVersion}', '')
            ), 'UTF8')), 'hex')
        )
    ) AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(${review}->'selectedEvidenceIds') selected_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(${review}->'selectedEvidenceProvenance') binding
        WHERE binding->>'evidenceId' = selected_id
      )
    )
  END)`;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === "string"
    ? item.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (character) => character.length === 2 ? character : "�")
    : item) ?? "null";
}
export function normalizeLegacySourceForImport(source: any): SourceRecord {
  if (source.accessMethod) return source;
  const at = source.updatedAt ?? source.createdAt ?? new Date().toISOString();
  return {
    ...source,
    name: source.name ?? source.id ?? "Legacy source",
    type: source.type ?? "static_web",
    accessMethod: "disabled",
    status: "candidate",
    risk: source.risk ?? "restricted",
    trustScore: Number.isFinite(source.trustScore) ? source.trustScore : 0.5,
    crawlFrequencySeconds: Number.isFinite(source.crawlFrequencySeconds) ? Math.max(60, source.crawlFrequencySeconds) : 3600,
    legalNotes: source.legalNotes ?? "Legacy source pending governance review.",
    governance: { ...source.governance, approvalRequired: true, approvalState: "pending", metadataOnly: source.governance?.metadataOnly ?? String(source.type ?? "").endsWith("_metadata") },
    createdAt: source.createdAt ?? at,
    updatedAt: at
  };
}
function nullable<T>(value: T | null | undefined): T | null { return value ?? null; }
function score(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0; }
function alertScore(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0; }
function count(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0; }
function nullableNonNegative(value: unknown): number | null { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null; }
function nullableScore(value: unknown): number | null { return value === undefined || value === null ? null : score(value); }
function actorAliasRecords(profile: any, firstSeenAt: string, lastSeenAt: string): any[] {
  if (profile.identityResolutionState === "archived") return [];
  const aliases = [...new Map(
    [...(profile.aliases ?? []), profile.canonicalName]
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => [value.trim().toLowerCase(), value.trim()])
  ).entries()];
  return aliases.map(([normalizedAlias, alias]) => ({
    id: stableId("actor-alias", `${profile.id}:${normalizedAlias}`),
    tenantId: profile.tenantId,
    actorProfileId: profile.id,
    alias,
    normalizedAlias,
    confidence: score(profile.confidence),
    firstSeenAt,
    lastSeenAt,
    evidenceCount: Math.max(1, count(profile.evidenceCount)),
    sourceIds: profile.sourceIds ?? [],
    captureIds: profile.captureIds ?? [],
    updatedAt: profile.updatedAt ?? lastSeenAt,
    ...(profile.privacyRedactedAt ? {
      privacyRedactedAt: profile.privacyRedactedAt,
      privacyDeletionRunId: profile.privacyDeletionRunId,
      privacyRecordType: "actor_alias",
      privacyAction: profile.privacyAction,
      privacyReason: profile.privacyReason
    } : {})
  }));
}

function validateValidationRecord(record: EvaluationValidationRecord): void {
  if (!record?.id || (!record.captureId && !record.incidentId && !record.claimId)) throw new Error("Validation record requires id and a capture, incident, or claim subject");
  if (!["supported", "partially_supported", "unconfirmed", "contradicted"].includes(record.status)) throw new Error(`Invalid validation status: ${record.status}`);
  if (!record.validationType || !record.referenceUrl || !record.matchedAt) throw new Error("Validation record requires validationType, referenceUrl, and matchedAt");
  if (record.validationType === "independent_evaluation_reference" && (
    record.status !== "supported"
    || !record.captureId
    || !record.referenceCaptureId
    || !record.referenceSourceId
    || !record.referenceContentHash
    || !record.labelType
    || !Array.isArray(record.expectedValues)
    || record.exhaustiveExpectedValues !== true
    || record.truthSchemaVersion !== "ti.independent_evaluation_reference.v1"
    || !record.truthFrozenAt
    || !record.expectedValuesHash
    || !record.reviewerId
  )) throw new Error("Independent evaluation reference requires frozen exhaustive label truth and immutable reference lineage");
}

function validateEvaluationLabel(label: EvaluationLabelRecord): void {
  if (!label?.id || (!label.captureId && !label.incidentId && !label.entityId && !label.indicatorId && !label.claimId)) throw new Error("Evaluation label requires id and a labeled subject");
  if (!label.outcome || !["true_positive", "false_positive", "false_negative", "true_negative", "correct", "incorrect", "needs_review"].includes(label.outcome)) throw new Error(`Invalid evaluation outcome: ${label.outcome}`);
  if (!label.labelType || !label.labeledBy || !label.labeledAt) throw new Error("Evaluation label requires labelType, labeledBy, and labeledAt");
}

function validateSourceHealthObservation(observation: any): void {
  if (!observation?.id || !observation.sourceId || !observation.checkedAt || !Number.isFinite(Date.parse(observation.checkedAt))) throw new Error("Source-health observation requires id, sourceId, and checkedAt");
  if (typeof observation.success !== "boolean" || !observation.status || !observation.legalMode) throw new Error("Source-health observation requires status, success, and legalMode");
}
