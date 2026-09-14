import React from 'react'
import { createRoot } from 'react-dom/client'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import LogsPageClient from '../../src/app/dashboard/logs/pageClient'

const logs = Array.from({ length: 30 }, (_, i) => ({ id: `old-${i}`, service: 'test', source: 'runtime' as const, level: 'info' as const, message: `Original log ${i}`, created_at: '2026-09-14T12:00:00Z', metadata: { detail: 'Retained context' } }))
createRoot(document.getElementById('root')!).render(
    <AppRouterContext.Provider value={{ replace() {} } as unknown as React.ContextType<typeof AppRouterContext>}>
        <PathnameContext.Provider value='/logs'><SearchParamsContext.Provider value={new URLSearchParams()}>
            <LogsPageClient id='fixture' token='fixture' initialServices={[]} initialStoredLogs={[]}
                initialRealtime={{ logs, containers: [], runtime_available: true, generated_at: '2026-09-14T12:00:00Z' }} initialErrors={{ generated_at: '', errors: [], summary: { total: 0, last_hour: 0, server_errors: 0, client_errors: 0, status_counts: [], surface_counts: [], code_counts: [], project_scans: 0, share_scans: 0 } }} />
        </SearchParamsContext.Provider></PathnameContext.Provider>
    </AppRouterContext.Provider>
)
