import ProfileIdentity from '@/components/profile/profileIdentity'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
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
    const section = params.id[1] || 'profile'
    const sections = [{ id: 'profile', label: 'Profile' }, { id: 'security', label: 'Security' }, { id: 'sessions', label: 'Sessions' }, { id: 'certificates', label: 'Certificates' }, { id: 'support', label: 'Support tickets' }]
    if (params.id.length > 2 || !sections.some(item => item.id === section)) notFound()
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
    const certificates = isSelf && section === 'certificates' ? await getCertificates(userId, token, userId) : null

    return (
        <DashboardPage>
            <DashboardPanel className='relative p-4'>
                <h1 className='wrap-break-word pr-10 text-xl font-semibold text-ui-text'>{displayName}</h1>
                <p className='mt-1 break-all pr-10 text-sm text-ui-muted'>@{username}</p>
                {profile?.email && <p className='mt-2 break-all text-sm text-ui-muted'>{profile.email}</p>}
                {isSelf && section === 'profile' && <ProfileIdentity displayName={displayName} username={username} />}
                {profile?.active === false && <p className='mt-2 text-sm text-ui-muted'>Inactive account</p>}
                {!profile && !isSelf && <p role='status' className='mt-2 text-sm text-ui-muted'>Profile details are unavailable. Please try again.</p>}
            </DashboardPanel>
            <nav aria-label='Account pages' className='flex flex-wrap gap-1 border-b border-ui-border pb-3'>
                {sections.map(item => <Link key={item.id} href={`/profile/${encodeURIComponent(username)}${item.id === 'profile' ? '' : `/${item.id}`}`} aria-current={section === item.id ? 'page' : undefined}
                    className={`rounded-md px-3 py-2 text-sm font-medium hover:bg-ui-raised ${section === item.id ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted'}`}>{item.label}</Link>)}
            </nav>
            {section === 'sessions' && <SessionsPanel isSelf />}
            {section === 'certificates' && <Certificates certificates={certificates} />}
            {section === 'support' && <SupportTickets />}
            {section === 'security' && <AccountActions isSelf />}
        </DashboardPage>
    )
}
