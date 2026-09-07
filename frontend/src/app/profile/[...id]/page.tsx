import ProfileIdentity from '@/components/profile/profileIdentity'
import { redirect } from 'next/navigation'
import Certificates from '@/components/profile/certificates'
import AccountActions from '@/components/profile/accountActions'
import SessionsPanel from '@/components/profile/sessions'
import SupportTickets from '@/components/profile/supportTickets'
import { DashboardPanel, DashboardPage } from '@/components/dashboard/ui'
import getCertificates from '@/utils/certificates/getCertificates'
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
    const profile = await fetchUser(profileId)
    const username = profile?.username || profile?.id || profileId
    const isSelf = Boolean(profile && profile.id === userId)
    if (profile && profileId !== username) redirect(`/profile/${encodeURIComponent(username)}`)

    if (!userId || !token) {
        const publicUser = profile
        const isInactive = publicUser?.active === false
        const displayName = isInactive ? profileId : publicUser?.name || profileId

        return (
            <div className='flex min-h-full w-full items-center justify-center bg-ui-canvas px-4 py-10 text-ui-text'>
                <section className='w-full max-w-xl rounded-lg border border-ui-border bg-ui-panel p-6 shadow-sm shadow-ui-canvas/20'>
                    <p className='text-xs font-semibold uppercase tracking-[0.14em] text-ui-primary'>Public profile</p>
                    <div className='mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='min-w-0'>
                            <h1 className='wrap-break-word text-3xl font-semibold text-ui-text'>{displayName}</h1>
                            <p className='mt-1 text-sm text-ui-muted'>@{username}</p>
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

    const displayName = profile?.name || (isSelf ? name : null) || profileId
    const certificates = isSelf ? await getCertificates(userId, token, userId) : null

    return (
        <DashboardPage>
            <DashboardPanel className='p-4'>
                <h1 className='wrap-break-word text-xl font-semibold text-ui-text'>{displayName}</h1>
                <p className='mt-1 text-sm text-ui-muted'>@{username}</p>
                {isSelf && <ProfileIdentity displayName={displayName} username={username} />}
                {profile?.active === false && <p className='mt-2 text-sm text-ui-muted'>Inactive account</p>}
                {!profile && !isSelf && <p role='status' className='mt-2 text-sm text-ui-muted'>Profile details are unavailable. Please try again.</p>}
            </DashboardPanel>
            {isSelf && <div className='grid gap-3 xl:grid-cols-2'>
                <div className='grid gap-3'>
                    <SessionsPanel isSelf />
                    <Certificates certificates={certificates} />
                    <SupportTickets />
                </div>
                <div className='grid content-start gap-3'>
                    <AccountActions isSelf />
                </div>
            </div>}
        </DashboardPage>
    )
}
