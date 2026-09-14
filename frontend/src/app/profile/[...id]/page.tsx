import ProfileIdentity from '@/components/profile/profileIdentity'
import { redirect } from 'next/navigation'
import Certificates from '@/components/profile/certificates'
import AccountActions from '@/components/profile/accountActions'
import SessionsPanel from '@/components/profile/sessions'
import SupportTickets from '@/components/profile/supportTickets'
import { DashboardPanel, DashboardPage } from '@/components/dashboard/ui'
import getCertificates from '@/utils/certificates/getCertificates'
import fetchUser from '@/utils/users/fetchUser'
import PublicProfile from '@/components/profile/publicProfile'
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
        return (
            <div className='min-h-full w-full bg-ui-canvas px-4 py-8 text-ui-text sm:px-6 sm:py-14'>
                <PublicProfile profile={profile} username={username} />
            </div>
        )
    }

    if (!isSelf) return <DashboardPage><PublicProfile profile={profile} username={username} /></DashboardPage>

    const displayName = profile?.name || (isSelf ? name : null) || profileId
    const certificates = isSelf ? await getCertificates(userId, token, userId) : null

    return (
        <DashboardPage>
            <DashboardPanel className='relative p-4'>
                <h1 className='wrap-break-word pr-10 text-xl font-semibold text-ui-text'>{displayName}</h1>
                <p className='mt-1 break-all pr-10 text-sm text-ui-muted'>@{username}</p>
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
