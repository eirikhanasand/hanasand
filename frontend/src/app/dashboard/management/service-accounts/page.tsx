import ServiceAccounts from '@/components/users/serviceAccounts'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export default function Page() {
    return <DashboardPage>
        <DashboardHeader eyebrow='Management' title='Service accounts' description='Reusable accounts for monitoring and automated tasks. Select the endpoints each account can access.' />
        <DashboardPanel className='p-4'><ServiceAccounts /></DashboardPanel>
    </DashboardPage>
}
