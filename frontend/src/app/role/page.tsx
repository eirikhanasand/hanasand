import Roles from '@/components/roles/roles'
import getRoles from '@/utils/roles/getRoles'
import { ShieldCheck } from 'lucide-react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/role%26expired=true')
    }

    const roles = await getRoles({ id, token })

    return (
        <section className='grid min-h-[90.5vh] gap-6 px-4 py-8 md:px-12 lg:px-24'>
            <div className='grid gap-2'>
                <div className='flex items-center gap-3 text-bright'>
                    <ShieldCheck className='h-5 w-5 text-orange-300' />
                    <h1 className='text-2xl font-semibold'>Roles</h1>
                </div>
                <p className='text-sm text-bright/55'>Review permissions, priorities, and the role structure currently active in the system.</p>
            </div>
            <Roles roles={roles} />
        </section>
    )
}
