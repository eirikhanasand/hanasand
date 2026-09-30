import ProfileIdentity from '@/components/profile/profileIdentity'
import ProfileOverview from '@/components/profile/profileOverview'
import getProfileStats from '@/utils/profile/getProfileStats'
import { redirect, notFound } from 'next/navigation'
import SshKeys from '@/components/profile/sshKeys'
import AccountActions from '@/components/profile/accountActions'
import SessionsPanel from '@/components/profile/sessions'
import SupportTickets from '@/components/profile/supportTickets'
import { DashboardPanel, DashboardPage } from '@/components/dashboard/ui'
import { getProfileSshKeys } from '@/utils/sshKeys'
import fetchUser from '@/utils/users/fetchUser'
import PublicProfile from '@/components/profile/publicProfile'
import { cookies } from 'next/headers'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const profileId = params.id[0]
    const section = params.id[1] || 'profile'
    const sections = ['profile', 'security', 'sessions', 'certificates', 'ssh-keys', 'support']
    if (params.id.length > 2 || !sections.includes(section)) notFound()
    if (section === 'certificates') redirect(`/profile/${encodeURIComponent(profileId)}/ssh-keys`)
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const profile = await fetchUser(profileId, userId && token ? { id: userId, token } : undefined)
    const username = profile?.username || profile?.id || profileId
    const isSelf = Boolean(profile && profile.id === userId)
    if (profile && profileId !== username) redirect(`/profile/${encodeURIComponent(username)}${section === 'profile' ? '' : `/${section}`}`)

    if (!userId || !token) {
        return (
            <div className='min-h-full w-full bg-ui-canvas px-4 py-8 text-ui-text sm:px-6 sm:py-14'>
                <PublicProfile key={username} profile={profile} username={username} />
            </div>
        )
    }

    if (!isSelf) return <DashboardPage><PublicProfile key={username} profile={profile} username={username} /></DashboardPage>

    const displayName = profile?.name || (isSelf ? name : null) || profileId
    const stats = section === 'profile' ? await getProfileStats(userId, token) : null
    const sshKeys = isSelf && section === 'ssh-keys' ? await getProfileSshKeys(userId, token) : null

    return (
        <DashboardPage>
            {section === 'profile' ? (
                <DashboardPanel className='relative p-4'>
                    <h1 className='wrap-break-word pr-10 text-xl font-semibold text-ui-text'>{displayName}</h1>
                    <p className='mt-1 break-all pr-10 text-sm text-ui-muted'>@{username}</p>
                    {profile?.email && <p className='mt-2 break-all text-sm text-ui-muted'>{profile.email}</p>}
                    <ProfileIdentity displayName={displayName} username={username} />
                    {profile?.active === false && <p className='mt-2 text-sm text-ui-muted'>Inactive account</p>}
                </DashboardPanel>
            ) : <p className='px-1 text-xs text-ui-muted'>@{username}</p>}
            {section === 'profile' && <ProfileOverview stats={stats} />}
            {section === 'sessions' && <SessionsPanel isSelf />}
            {section === 'ssh-keys' && <SshKeys initialKeys={sshKeys} />}
            {section === 'support' && <SupportTickets />}
            {section === 'security' && <AccountActions isSelf />}
        </DashboardPage>
    )
}
