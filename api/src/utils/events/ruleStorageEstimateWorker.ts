import { loadConfiguredRules } from '../../handlers/events.ts'
import run, { isDatabaseLowLoad, tryWithDatabaseAdvisoryLock } from '#db'
import { ReadAdmissionError } from '../readCache.ts'
import { internalRetentionRuleIds } from './ruleList.ts'
import { estimateStoredRuleEvents } from './rulePreview.ts'

export const RULE_STORAGE_ESTIMATE_JOB_ID = 'api-rule-storage-estimates'

export async function runRuleStorageEstimateWorker() {
    const lock = await tryWithDatabaseAdvisoryLock('rule-storage-estimate-worker', async() => {
        if (!(await isDatabaseLowLoad())) return 'busy'

        const [organizations, handled] = await Promise.all([
            run('SELECT id FROM organizations ORDER BY id'),
            run(`SELECT organization_id,rule_id,rule_version FROM rule_storage_estimates
                WHERE scanned_date=(NOW() AT TIME ZONE 'UTC')::date
                    AND (generated_at IS NOT NULL OR scan_finished_at IS NOT NULL
                        OR scan_started_at >= NOW() - INTERVAL '15 minutes')`),
        ])
        const completed = new Set(handled.rows.map(row => `${row.organization_id}:${row.rule_id}:${row.rule_version}`))

        for (const organization of organizations.rows) {
            if (!(await isDatabaseLowLoad())) return 'busy'
            const organizationId = String(organization.id)
            const rules = await loadConfiguredRules(organizationId)
            for (const rule of rules) {
                const definition = rule.definition
                if (internalRetentionRuleIds.has(rule.id) || definition?.stage !== 'analyze' || definition.action !== 'drop' || !definition.conditions?.length) continue
                if (completed.has(`${organizationId}:${rule.id}:${rule.version}`)) continue
                if (!(await isDatabaseLowLoad())) return 'busy'
                try {
                    await estimateStoredRuleEvents(organizationId, rule.id, rule.version, definition.conditions, run, isDatabaseLowLoad)
                } catch (error) {
                    if (!(error instanceof ReadAdmissionError)) throw error
                }
                return 'handled'
            }
        }
        return 'current'
    })
    return lock.acquired ? lock.result : 'locked'
}
