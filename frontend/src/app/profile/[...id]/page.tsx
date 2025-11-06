import Certificate from '@/components/profile/certificate'
import { getCertificates } from '@/utils/certificates/getCertificates'
import { LayoutDashboard, Plus } from 'lucide-react'
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
                <div className='grid h-fit w-full p-2 outline-1 outline-dark rounded-lg'>
                    <div className='flex justify-between mb-2 items-center'>
                        <h1 className='font-semibold text-lg self-center'>Certificates</h1>
                        <Link href='/dashboard/thoughts/create' className='flex gap-2 rounded-lg p-[3px] px-8 hover:outline-green-500/40 outline-1 outline-dark cursor-pointer hover:bg-green-500/25'>
                            <Plus className='stroke-bright/80' />
                            <h1 className='font-semibold text-bright/80'>Add</h1>
                        </Link>
                    </div>
                    {certificates 
                        ? (certificates as Certificate[]).map((certificate) => <Certificate key={certificate.id} certificate={certificate} />)
                        : <>No certificates found! Click create to add one.</>
                    }
                </div>
            </div>
        </div>
    )
}
