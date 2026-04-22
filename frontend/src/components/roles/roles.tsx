import DashboardRole from './dashboardRole'
import { Crown, Shield } from 'lucide-react'

export default async function Roles({ roles }: { roles: Role[] }) {
    return (
        <section className='grid h-fit w-full self-start gap-3 rounded-xl border border-white/10 bg-white/4 p-4'>
            <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-2'>
                    <Shield className='h-4 w-4 text-orange-300' />
                    <h1 className='text-lg font-semibold text-bright'>Roles</h1>
                </div>
                <div className='flex items-center gap-2 text-xs font-medium text-bright/45'>
                    <Crown className='h-3.5 w-3.5 text-amber-300' />
                    Priority
                </div>
            </div>
            <div className='grid gap-2'>
                {roles.map((role) => <DashboardRole key={role.id} role={role} />)}
            </div>
        </section>
    )
}
