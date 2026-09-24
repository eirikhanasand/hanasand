import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/ui'
import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import DeliveryClient from './deliveryClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const store = await cookies()
    const identityId = store.get('impersonating_id')?.value || store.get('id')?.value
    if (!identityId || !store.get('access_token')?.value) redirect('/login?path=%2Fdwm%2Factions')
    const scopeId = await activeOrganizationId() || identityId
    return <DashboardPage><DeliveryClient key={scopeId} scopeId={scopeId} /></DashboardPage>
}
