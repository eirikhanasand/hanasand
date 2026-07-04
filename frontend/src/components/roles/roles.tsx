import DashboardRole from './dashboardRole'
import { Crown, Shield } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

export default async function Roles({ roles }: { roles: Role[] }) {
    return (
        <DashboardPanel className='grid h-fit w-full self-start gap-3 p-4'>
            <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-2'>
                    <Shield className='h-4 w-4 text-ui-muted' />
                    <h1 className='text-base font-semibold text-ui-text'>Roles</h1>
                </div>
                <div className='flex items-center gap-2 text-xs font-medium text-ui-muted'>
                    <Crown className='h-3.5 w-3.5 text-ui-warning' />
                    Priority
                </div>
            </div>
            <div className='grid gap-2'>
                {roles.map((role) => <DashboardRole key={role.id} role={role} />)}
            </div>
        </DashboardPanel>
    )
}
