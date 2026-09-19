import React, { useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import LogsPageClient from '../../src/app/dashboard/logs/pageClient'

const subscribe = (callback: () => void) => {
    window.addEventListener('popstate', callback)
    return () => window.removeEventListener('popstate', callback)
}
function navigate(href: string) {
    window.history.pushState(null, '', href)
    window.dispatchEvent(new Event('popstate'))
}
function Fixture() {
    const pathname = useSyncExternalStore(subscribe, () => window.location.pathname)
    return <AppRouterContext.Provider value={{ push: navigate, replace: navigate, prefetch: async () => {}, refresh() {} } as unknown as React.ContextType<typeof AppRouterContext>}>
        <PathnameContext.Provider value={pathname}><SearchParamsContext.Provider value={new URLSearchParams(window.location.search)}>
            <LogsPageClient key={pathname} initialServices={[{ service: 'api', entries: 10, last_seen: '' }, { service: 'audit', entries: 5, last_seen: '' }]} initialErrors={{ generated_at: '', errors: [], summary: { total: 0, last_hour: 0, server_errors: 0, client_errors: 0, status_counts: [], surface_counts: [], code_counts: [], project_scans: 0, share_scans: 0 } }} />
        </SearchParamsContext.Provider></PathnameContext.Provider>
    </AppRouterContext.Provider>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
