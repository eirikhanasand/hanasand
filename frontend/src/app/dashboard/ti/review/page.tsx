import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import ReviewWorkspace from './reviewWorkspace'

export const dynamic = 'force-dynamic'

export default function TiClaimReviewPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Intelligence review'
                description='Supervise persisted Hanasand AI decisions and resolve claims that still require an analyst.'
            />
            <ReviewWorkspace />
        </DashboardPage>
    )
}
