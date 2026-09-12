import React from 'react'
import { createRoot } from 'react-dom/client'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import PendingDeletionPage from '../../src/app/account-pending-deletion/pageClient'
createRoot(document.getElementById('root')!).render(
    <AppRouterContext.Provider value={{ push(url: string) { window.history.pushState(null, '', url) }, prefetch: async () => {}, replace() {} } as unknown as React.ContextType<typeof AppRouterContext>}>
        <PendingDeletionPage id='recovery-user' restoreToken='' deletionScheduledAt='2026-10-13T12:00:00Z' />
    </AppRouterContext.Provider>
)
