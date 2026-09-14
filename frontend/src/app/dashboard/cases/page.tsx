import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/ui'
import CasesClient from './cases-client'

export const dynamic = 'force-dynamic'
export default async function CasesPage() {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) redirect('/login?path=%2Fcases')
    const organizationId = await activeOrganizationId()
    return <DashboardPage><CasesClient key={organizationId || 'personal'} organizationId={organizationId} /></DashboardPage>
}
