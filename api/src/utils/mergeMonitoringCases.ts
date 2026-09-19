import run, { withTransaction } from './db.ts'
import { correlationKey, monitoringScope } from './monitoringCorrelation.ts'
import type { AutomationRow } from './automations.ts'
import { monitoringIssueFingerprint } from './monitoringIssues.ts'

// Run with the scheduled worker stopped. Keep old case rows as permanent aliases; never discard evidence.
export async function mergeMonitoringCases(automationIds?: string[]) {
    const roots = await run(`SELECT a.*, i.id AS case_id FROM monitoring_issues i JOIN agent_automations a ON a.id=i.automation_id
        WHERE i.merged_into IS NULL AND ($1::text[] IS NULL OR a.id=ANY($1)) ORDER BY i.first_seen_at, i.id`, [automationIds || null])
    const merged: Array<{ from: string, to: string }> = []
    for (const source of roots.rows) await withTransaction(async query => {
        const a = source as AutomationRow
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [monitoringScope(a)])
        const row = (await query('SELECT * FROM monitoring_issues WHERE id=$1 AND merged_into IS NULL FOR UPDATE', [source.case_id])).rows[0]
        if (!row) return
        const key = await correlationKey(query, a, monitoringIssueFingerprint(a, row.kind, row.summary), row.kind, row.summary)
        const canonical = (await query('SELECT * FROM monitoring_issues WHERE correlation_key=$1 AND id<>$2 FOR UPDATE', [key, row.id])).rows[0]
        if (!canonical) { await query('UPDATE monitoring_issues SET correlation_key=$2 WHERE id=$1', [row.id,key]); return }
        const ids = [row.id, canonical.id]
        await query(`INSERT INTO monitoring_issue_checks(issue_id,automation_id,active)
            SELECT $2,automation_id,active FROM monitoring_issue_checks WHERE issue_id=$1
            ON CONFLICT(issue_id,automation_id) DO UPDATE SET active=monitoring_issue_checks.active OR EXCLUDED.active`, ids)
        await query('UPDATE agent_automation_runs SET issue_id=$2 WHERE issue_id=$1', ids)
        await query('UPDATE monitoring_issue_messages SET issue_id=$2 WHERE issue_id=$1', ids)
        await query(`INSERT INTO monitoring_issue_notifications(issue_id,destination,next_attempt_at,delivered_at,last_error,message_id,mentioned_everyone)
            SELECT $2,destination,next_attempt_at,delivered_at,last_error,message_id,mentioned_everyone FROM monitoring_issue_notifications WHERE issue_id=$1
            ON CONFLICT(issue_id,destination) DO UPDATE SET next_attempt_at=GREATEST(monitoring_issue_notifications.next_attempt_at,EXCLUDED.next_attempt_at)`, ids)
        await query(`UPDATE monitoring_issues c SET occurrences=c.occurrences+d.occurrences,
            first_seen_at=LEAST(c.first_seen_at,d.first_seen_at), last_seen_at=GREATEST(c.last_seen_at,d.last_seen_at),
            summary=CASE WHEN d.last_seen_at>c.last_seen_at THEN d.summary ELSE c.summary END,
            resolved_at=CASE WHEN c.resolved_at IS NULL OR d.resolved_at IS NULL THEN NULL ELSE GREATEST(c.resolved_at,d.resolved_at) END,
            resolution=CASE WHEN c.status_override IS NOT NULL THEN c.resolution
                WHEN c.resolved_at IS NULL OR d.resolved_at IS NULL THEN NULL
                WHEN d.resolved_at>c.resolved_at THEN d.resolution ELSE c.resolution END,
            notifications_enabled=c.notifications_enabled AND d.notifications_enabled,
            comments=c.comments || d.comments, history=c.history || d.history || jsonb_build_array(jsonb_build_object(
                'id',gen_random_uuid()::text,'at',NOW(),'actor','Case correlation','actorType','automation','action','cases_merged',
                'note','Merged HA-' || d.id || ' into HA-' || c.id || ' because the technical indicators and access scope match. All underlying runs and messages were retained.'))
            FROM monitoring_issues d WHERE d.id=$1 AND c.id=$2`, ids)
        await query('UPDATE monitoring_issues SET merged_into=$2 WHERE merged_into=$1', ids)
        await query('UPDATE monitoring_issues SET merged_into=$2,correlation_key=NULL WHERE id=$1', ids)
        // Keep source workflow metadata on its alias as well as in the merged timeline.
        if ((await query('SELECT to_regclass(\'public.case_development\') AS relation')).rows[0]?.relation) {
            await query(`UPDATE case_development SET case_references=array_append(case_references,$2)
                WHERE $1=ANY(case_references) AND NOT $2=ANY(case_references)`, [`HA-${row.id}`,`HA-${canonical.id}`])
        }
        merged.push({ from: `HA-${row.id}`, to: `HA-${canonical.id}` })
    })
    return merged
}
