import BlocklistClient from './blocklistClient'
import getBlocklist from '@/utils/traffic/getBlocklist'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const blocklist = await getBlocklist()

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Traffic' title='Blocklist' description='Manage IP addresses and user agents blocked from production traffic.' />
            <BlocklistClient initialBlocklist={Array.isArray(blocklist) ? blocklist : []} />
        </DashboardPage>
    )
}
