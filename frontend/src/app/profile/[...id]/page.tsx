import Certificates from '@/components/profile/certificates'
import AccountActions from '@/components/profile/accountActions'
import SessionsPanel from '@/components/profile/sessions'
import DashboardSidebar from '@/components/dashboard/dashboardSidebar'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import getCertificates from '@/utils/certificates/getCertificates'
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
            <div className='flex min-h-full w-full items-center justify-center bg-ui-canvas px-4 py-10 text-ui-text'>
                <section className='w-full max-w-xl rounded-lg border border-ui-border bg-ui-panel p-6 shadow-sm shadow-ui-canvas/20'>
                    <p className='text-xs font-semibold uppercase tracking-[0.14em] text-ui-primary'>Public profile</p>
                    <div className='mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='min-w-0'>
                            <h1 className='wrap-break-word text-3xl font-semibold text-ui-text'>{displayName}</h1>
                            <p className='mt-1 text-sm text-ui-muted'>@{profileId}</p>
                        </div>
                        <span className={`w-fit rounded-lg border px-3 py-1.5 text-xs font-semibold ${isInactive ? 'border-ui-warning/40 bg-ui-warning/10 text-ui-warning' : 'border-ui-success/40 bg-ui-success/10 text-ui-success'}`}>
                            {isInactive ? 'Reserved' : 'Active'}
                        </span>
                    </div>
                    <p className='mt-5 text-sm leading-6 text-ui-muted'>
                        Public account page for Hanasand. Sign in to manage account access, active sessions, and API certificates.
                    </p>
                    <div className='mt-6 flex flex-wrap gap-2'>
                        <Link href={`/login?path=/profile/${profileId}`} className='rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-text transition-colors hover:opacity-90'>
                            Log in
                        </Link>
                        <Link href='/' className='rounded-lg border border-ui-border px-4 py-2 text-sm font-semibold text-ui-text transition-colors hover:bg-ui-raised'>
                            Home
                        </Link>
                    </div>
                </section>
            </div>
        )
    }

    const certificates = await getCertificates(userId, token, userId)
    const displayName = name || profileId

    return (
        <div className='h-full min-h-0 overflow-hidden bg-ui-canvas px-2 pb-2 text-ui-text'>
            <div className='grid h-full min-h-0 gap-2 overflow-hidden lg:grid-cols-[auto_minmax(0,1fr)]'>
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
                            title='Account profile'
                            description={`Signed in as @${displayName}. Manage account access, active devices, and API certificates.`}
                        />
                        <div className='grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.65fr)]'>
                            <div className='grid gap-3'>
                                <SessionsPanel isSelf={isSelf} />
                                <Certificates certificates={certificates} />
                            </div>
                            <div className='grid content-start gap-3'>
                                <AccountActions isSelf={isSelf} />
                            </div>
                        </div>
                    </DashboardPage>
                </div>
            </div>
        </div>
    )
}
