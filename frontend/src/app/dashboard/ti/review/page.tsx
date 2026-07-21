import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import ClaimReviewClient from './claimReviewClient'

export const dynamic = 'force-dynamic'

export default function TiClaimReviewPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Claim review'
                description='Resolve extracted intelligence claims before they become trusted facts or customer-facing exports.'
            />
            <ClaimReviewClient />
        </DashboardPage>
    )
}
