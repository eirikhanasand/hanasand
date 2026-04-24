import Certificates from '@/components/profile/certificates'
import SessionsPanel from '@/components/profile/sessions'
import VMs from '@/components/profile/vms'
import getCertificates from '@/utils/certificates/getCertificates'
import getVMs from '@/utils/vms/fetch/getVMs'
import { LayoutDashboard } from 'lucide-react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const profileId = params.id[0]
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const userId = Cookies.get('id')?.value
    const isSelf = profileId === userId
    
    if (!name || !userId) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const certificates = await getCertificates(userId)
    const vms = await getVMs(userId)

    return (
        <div className='h-full'>
            <div className='grid gap-3 px-4 py-6 sm:px-6 md:px-10 lg:px-16 xl:px-24'>
                <div className='flex w-full flex-col gap-3 rounded-lg sm:flex-row sm:items-center sm:justify-between'>
                    <h1 className='text-xl font-semibold flex-1'>@{name}</h1>
                    <div className='grid h-fit w-fit px-2 py-1 outline-1 outline-dark rounded-lg gap-2'>
                        <Link href='/dashboard' className='flex justify-between px-6 group cursor-pointer gap-2'>
                            <LayoutDashboard className='stroke-current group-hover:stroke-[#374c66]' />
                            <h1 className='font-semibold text-base self-center'>Dashboard</h1>
                        </Link>
                    </div>
                </div>
                <div className='grid gap-3 lg:grid-cols-2'>
                    <VMs vms={vms} />
                    <Certificates certificates={certificates} />
                </div>
                <SessionsPanel isSelf={isSelf} />
            </div>
        </div>
    )
}
