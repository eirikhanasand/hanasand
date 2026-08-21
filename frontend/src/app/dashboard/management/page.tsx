import Roles from '@/components/roles/roles'
import Users from '@/components/users/users'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import getRoles from '@/utils/roles/getRoles'
import fetchUsersWithRoles from '@/utils/users/fetchUsersWithRoles'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { Radio, Shield, UserRound, UsersRound } from 'lucide-react'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import type { ReactNode } from 'react'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value || ''
    if (!name || !id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const [roles, users] = await Promise.all([
        getRoles({ id, token, cache: 'no-store' }),
        fetchUsersWithRoles({ id, token, cache: 'no-store' })
    ])
    const refreshedAt = new Date()
    void name
    const reservedSet = new Set(reservedUsernames)
    const reservedCount = users.filter((user) => reservedSet.has(user.id.toLowerCase())).length
    const assignedUsers = users.filter((user) => user.highest_role_id).length
    const priorityRole = [...roles].sort((a, b) => a.priority - b.priority)[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Admin'
                title='User management'
                description='User access, role coverage, reserved accounts, and support controls.'
            />
            <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <AdminMetric icon={<UsersRound className='h-4 w-4' />} label='Users' value={String(users.length)} detail={`${assignedUsers} with roles`} tone={users.length ? 'ok' : 'watch'} />
                <AdminMetric icon={<Shield className='h-4 w-4' />} label='Roles' value={String(roles.length)} detail={priorityRole ? `Highest: ${priorityRole.name}` : 'roles are ready'} tone={roles.length ? 'ok' : 'watch'} />
                <AdminMetric icon={<UserRound className='h-4 w-4' />} label='Reserved' value={String(reservedCount)} detail='Reserved accounts' tone={reservedCount ? 'neutral' : 'ok'} />
                <AdminMetric icon={<Radio className='h-4 w-4' />} label='Admin controls' value='Connected' detail={`Last refreshed ${formatRefreshTime(refreshedAt)}`} tone='ok' />
            </section>
            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='grid divide-y divide-ui-border md:grid-cols-4 md:divide-x md:divide-y-0'>
                    <AdminAction href='/dashboard/helpdesk' label='Support access' value='audit trail' />
                    <AdminAction href='/dashboard/system/rates' label='API tokens' value='scoped keys' />
                    <AdminAction href='/dashboard/content' label='Content management' value='articles and thoughts' />
                    <AdminAction href='/dashboard/ti/audit' label='Audit log' value='admin activity' />
                </div>
            </DashboardPanel>
            <div className='grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] xl:items-start'>
                <Users roles={roles} initialUsers={users} />
                <Roles roles={roles} />
            </div>
        </DashboardPage>
    )
}

function formatRefreshTime(date: Date) {
    return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    }).format(date)
}

function AdminMetric({ icon, label, value, detail, tone }: { icon: ReactNode, label: string, value: string, detail: string, tone: 'ok' | 'watch' | 'neutral' }) {
    const dot = tone === 'ok'
        ? 'bg-ui-success shadow-[0_0_14px_rgba(49,196,141,0.65)]'
        : tone === 'watch'
            ? 'bg-ui-warning shadow-[0_0_14px_rgba(246,180,95,0.45)]'
            : 'bg-ui-primary shadow-[0_0_14px_rgba(157,180,255,0.45)]'
    const text = tone === 'ok' ? 'text-ui-success' : tone === 'watch' ? 'text-ui-warning' : 'text-ui-primary'

    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3 text-sm text-ui-muted'>
                <span>{label}</span>
                <span className={text}>{icon}</span>
            </div>
            <div className='mt-3 flex items-center gap-2 text-2xl font-semibold text-ui-text'>
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {value}
            </div>
            <p className='mt-2 line-clamp-2 text-sm leading-5 text-ui-muted'>{detail}</p>
        </DashboardPanel>
    )
}

function AdminAction({ href, label, value }: { href: string, label: string, value: string }) {
    return (
        <Link href={href} className='grid gap-1 bg-ui-panel px-4 py-3 transition hover:bg-ui-raised'>
            <span className='text-sm font-semibold text-ui-text'>{label}</span>
            <span className='text-xs font-medium text-ui-muted'>{value}</span>
        </Link>
    )
}
