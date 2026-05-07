import Certificates from '@/components/profile/certificates'
import AccountActions from '@/components/profile/accountActions'
import SessionsPanel from '@/components/profile/sessions'
import VMs from '@/components/profile/vms'
import DashboardSidebar from '@/components/dashboard/dashboardSidebar'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import getCertificates from '@/utils/certificates/getCertificates'
import getVMs from '@/utils/vms/fetch/getVMs'
import parseCookie from '@/utils/cookies/parseCookie'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const profileId = params.id[0]
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const rolesCookie = Cookies.get('roles')?.value
    const roles = parseCookie<Array<Role | string>>(rolesCookie, [])
    const isAdmin = roles.some((role) => typeof role === 'string' ? role.includes('admin') : role.id?.includes('admin'))
    const isSelf = profileId === userId

    if (!name || !userId || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const certificates = await getCertificates(userId)
    const vms = await getVMs(userId, token, userId)

    return (
        <div className='h-full px-2 pb-2'>
            <div className='grid h-full min-h-0 gap-2 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start'>
                <DashboardSidebar id={userId} isAdmin={isAdmin} />
                <div className='min-h-0 min-w-0 overflow-auto'>
                    <DashboardPage>
                        <DashboardHeader
                            eyebrow='Profile'
                            title={`@${name}`}
                            description='Account, access, and workspace resources.'
                        />
                        <div className='grid gap-3 xl:grid-cols-2'>
                            <SessionsPanel isSelf={isSelf} />
                            <VMs vms={vms} />
                            <Certificates certificates={certificates} />
                            <AccountActions isSelf={isSelf} />
                        </div>
                    </DashboardPage>
                </div>
            </div>
        </div>
    )
}
