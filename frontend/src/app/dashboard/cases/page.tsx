import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/ui'
import CasesClient from './cases-client'

export const dynamic = 'force-dynamic'
export default async function CasesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const [cookieStore, params] = await Promise.all([cookies(), searchParams])
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) redirect('/login?path=%2Fcases')
    const organizationId = typeof params?.organizationId === 'string' ? params.organizationId : undefined
    return <DashboardPage><CasesClient key={organizationId || 'personal'} organizationId={organizationId} /></DashboardPage>
}
