import Users from '@/components/users/users'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import fetchUsers from '@/utils/users/fetchUsers'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { UserRound, UsersRound } from 'lucide-react'
import { isReservedPlaceholder } from '@/utils/users/isReservedPlaceholder'
import type { ReactNode } from 'react'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value || ''
    if (!name || !id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const users = await fetchUsers({ id, token, cache: 'no-store' })
    void name
    const reservedCount = users.filter(isReservedPlaceholder).length
    const currentUser = users.find(user => user.id === id)
    const accessibleOrganizationIds = currentUser?.active === false ? [] : (currentUser?.organization_memberships || [])
        .filter(organization => organization.status === 'active')
        .map(organization => organization.id)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Admin'
                title='User management'
                description='User accounts and support controls.'
            />
            <section className='grid gap-3 md:grid-cols-2'>
                <AdminMetric icon={<UsersRound className='h-4 w-4' />} label='Users' value={String(users.length)} detail='Registered accounts' />
                <AdminMetric icon={<UserRound className='h-4 w-4' />} label='Reserved' value={String(reservedCount)} detail='Reserved accounts' />
            </section>
            <Users initialUsers={users} accessibleOrganizationIds={accessibleOrganizationIds} />
        </DashboardPage>
    )
}

function AdminMetric({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
            <div className='flex items-center justify-between gap-3'>
                <span className='text-sm text-ui-muted'>{label}</span>
                <span className='text-ui-muted'>{icon}</span>
            </div>
            <div className='mt-1 text-xl font-medium text-ui-text'>{value}</div>
            <p className='mt-1 text-xs text-ui-muted'>{detail}</p>
        </DashboardPanel>
    )
}
