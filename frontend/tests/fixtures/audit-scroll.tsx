import React from 'react'
import { createRoot } from 'react-dom/client'
import AuditTimeline from '../../src/app/dashboard/management/audit/timeline'
document.cookie = 'id=audit-fixture; path=/'
document.cookie = 'access_token=fixture-only; path=/'
const events = Array.from({ length: 50 }, (_, i) => ({ id: 125-i, happenedAt: '2026-09-14T00:00:00Z', actor: 'operator', service: 'test', action: 'read', target: 'test', result: 'success', detail: '', severity: 'info', source: 'test', actorId: 'operator', targetName: 'test', organization: '', entity: '', request: '', ip: '', acknowledgedAt: null, acknowledgedBy: null, acknowledgedByName: null }))
createRoot(document.getElementById('root')!).render(<AuditTimeline initialAudit={{ events, total: 125, nextCursor: 'first', available: true }} filters={{ service: 'test' }} />)
