import Certificates from '@/components/profile/certificates'
import AccountActions from '@/components/profile/accountActions'
import SessionsPanel from '@/components/profile/sessions'
import VMs from '@/components/profile/vms'
import DashboardSidebar from '@/components/dashboard/dashboardSidebar'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import getCertificates from '@/utils/certificates/getCertificates'
import getVMs from '@/utils/vms/fetch/getVMs'
import parseCookie from '@/utils/cookies/parseCookie'
import fetchUser from '@/utils/users/fetchUser'
import Link from 'next/link'
import { cookies } from 'next/headers'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const profileId = params.id[0]
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const rolesCookie = Cookies.get('roles')?.value
    const roles = parseCookie<Array<Role | string>>(rolesCookie, [])
    const roleIds = roles.map((role) => typeof role === 'string' ? role : role.id || '')
    const hasRole = (roleId: string) => roleIds.includes(roleId)
    const isAdmin = hasRole('administrator') || hasRole('admin')
    const canManageSystem = isAdmin || hasRole('system_admin')
    const canManageContent = isAdmin || hasRole('content_admin')
    const isSelf = profileId === userId

    if (!userId || !token) {
        const publicUser = await fetchUser(profileId)
        const isInactive = publicUser?.active === false
        const displayName = isInactive ? profileId : publicUser?.name || profileId

        return (
            <div className='flex min-h-full w-full items-center justify-center bg-[#f7f8fb] px-4 py-10'>
                <section className='w-full max-w-xl rounded-lg border border-[#dde3ec] bg-white p-6 shadow-sm'>
                    <p className='text-xs font-semibold uppercase tracking-[0.14em] text-[#687386]'>Public profile</p>
                    <div className='mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='min-w-0'>
                            <h1 className='wrap-break-word text-3xl font-semibold text-[#171a21]'>{displayName}</h1>
                            <p className='mt-1 text-sm text-[#687386]'>@{profileId}</p>
                        </div>
                        <span className={`w-fit rounded-lg border px-3 py-1.5 text-xs font-semibold ${isInactive ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                            {isInactive ? 'Reserved' : 'Active'}
                        </span>
                    </div>
                    <p className='mt-5 text-sm leading-6 text-[#596170]'>
                        Public account page for Hanasand. Sign in to manage account access, active sessions, API certificates, and product workspace details.
                    </p>
                    <div className='mt-6 flex flex-wrap gap-2'>
                        <Link href={`/login?path=/profile/${profileId}`} className='rounded-lg bg-[#171a21] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2b303b]'>
                            Log in
                        </Link>
                        <Link href='/' className='rounded-lg border border-[#d8dee9] px-4 py-2 text-sm font-semibold text-[#364152] transition-colors hover:bg-[#f2f5f9]'>
                            Home
                        </Link>
                    </div>
                </section>
            </div>
        )
    }

    const certificates = await getCertificates(userId, token, userId)
    const vms = canManageSystem ? await getVMs(userId, token, userId) : []
    const displayName = name || profileId

    return (
        <div className='h-full px-2 pb-2'>
            <div className='grid h-full min-h-0 gap-2 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start'>
                <DashboardSidebar
                    id={userId}
                    isAdmin={isAdmin}
                    canManageSystem={canManageSystem}
                    canManageContent={canManageContent}
                />
                <div className='min-h-0 min-w-0 overflow-auto'>
                    <DashboardPage>
                        <DashboardHeader
                            eyebrow='Profile'
                            title={`@${displayName}`}
                            description='Account access, API credentials, and product workspace details.'
                        />
                        <div className='grid gap-3 xl:grid-cols-2'>
                            <SessionsPanel isSelf={isSelf} />
                            {canManageSystem && <VMs vms={vms} />}
                            <Certificates certificates={certificates} />
                            <AccountActions isSelf={isSelf} />
                        </div>
                    </DashboardPage>
                </div>
            </div>
        </div>
    )
}
