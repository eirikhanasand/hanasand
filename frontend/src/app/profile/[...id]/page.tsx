import Certificates from '@/components/profile/certificates'
import getCertificates from '@/utils/certificates/getCertificates'
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

    return (
        <div className='h-full'>
            <div className='px-16 py-8 grid gap-2'>
                <div className='flex w-full rounded-lg justify-between items-center'>
                    <h1 className='text-xl font-semibold flex-1'>@{name}</h1>
                    <div className='grid h-fit w-fit p-2 outline-1 outline-dark rounded-lg gap-2'>
                        <Link href={`/profile/${userId}`} className='flex justify-between px-6 group cursor-pointer gap-2'>
                            <LayoutDashboard className='stroke-current group-hover:stroke-[#374c66]' />
                            <h1 className='font-semibold text-base self-center'>Dashboard</h1>
                        </Link>
                    </div>
                </div>
                <Certificates certificates={certificates} />
            </div>
        </div>
    )
}
