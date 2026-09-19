import { compileQuery } from './logs/kql.ts'

export function compileAuditQuery(input: string) {
    return compileQuery(input, {
        tables: ['AuditEvents'],
        defaultOrder: 'e.created_at DESC, e.id DESC',
        idColumn: 'e.id',
        fields: {
            TimeGenerated: 'e.created_at',
            Service: 'COALESCE(NULLIF(e.service, \'\'), e.source, \'—\')',
            Actor: 'COALESCE(NULLIF(actor.name, \'\'), e.actor_id, \'system\')',
            Action: 'e.event_type',
            Target: 'COALESCE(NULLIF(target_user.name, \'\'), NULLIF(e.object_id, \'\'), e.object_type, \'—\')',
            Result: 'e.outcome',
            Description: 'COALESCE(NULLIF(e.reason, \'\'), e.service, \'\')',
        },
    })
}
