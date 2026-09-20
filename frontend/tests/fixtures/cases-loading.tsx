import { createRoot } from 'react-dom/client'
import { useState, type ContextType } from 'react'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import CasesClient from '../../src/app/dashboard/cases/cases-client'

function Fixture() {
    const [organizationId, setOrganizationId] = useState('org-a')
    return <AppRouterContext.Provider value={{ push() {}, prefetch: async () => {} } as unknown as ContextType<typeof AppRouterContext>}>
        <button onClick={() => setOrganizationId('org-b')}>Switch organization</button>
        <CasesClient key={organizationId} organizationId={organizationId} />
    </AppRouterContext.Provider>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
