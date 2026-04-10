import { ArrowLeft, Crown, ShieldCheck, Tag } from 'lucide-react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import getRole from '@/utils/roles/getRole'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const roleId = params.id[0]
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/role%26expired=true')
    }

    const role = await getRole({ id, token, roleId })
    if (!role) {
        return notFound()
    }

    return (
        <section className='grid min-h-[90.5vh] gap-6 px-4 py-8 md:px-12 lg:px-24'>
            <div className='flex items-center justify-between gap-3'>
                <div className='grid gap-2'>
                    <div className='flex items-center gap-3 text-bright'>
                        <ShieldCheck className='h-5 w-5 text-orange-300' />
                        <h1 className='text-2xl font-semibold'>{role.name}</h1>
                    </div>
                    <p className='text-sm text-bright/55'>Role details for production permission review.</p>
                </div>
                <Link href='/role' className='flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/70 hover:bg-white/8'>
                    <ArrowLeft className='h-4 w-4' />
                    Back
                </Link>
            </div>

            <div className='grid gap-4 lg:grid-cols-3'>
                <StatCard
                    icon={<Tag className='h-4 w-4 text-orange-300' />}
                    label='Role Id'
                    value={role.id}
                />
                <StatCard
                    icon={<Crown className='h-4 w-4 text-amber-300' />}
                    label='Priority'
                    value={String(role.priority)}
                />
                <StatCard
                    icon={<ShieldCheck className='h-4 w-4 text-emerald-300' />}
                    label='Created'
                    value={new Date(role.created_at).toLocaleString()}
                />
            </div>

            <section className='grid gap-3 rounded-xl border border-white/10 bg-white/4 p-5'>
                <h2 className='text-sm font-semibold text-bright'>Description</h2>
                <p className='text-sm leading-6 text-bright/70'>{role.description || 'No description has been added yet.'}</p>
            </section>
        </section>
    )
}

function StatCard({
    icon,
    label,
    value
}: {
    icon: React.ReactNode
    label: string
    value: string
}) {
    return (
        <div className='grid gap-2 rounded-xl border border-white/10 bg-white/4 p-4'>
            <div className='flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-bright/45'>
                {icon}
                {label}
            </div>
            <div className='break-all text-sm text-bright/85'>{value}</div>
        </div>
    )
}
