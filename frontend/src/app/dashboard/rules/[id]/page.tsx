import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import RuleDetails from './rule-details'

export const metadata = { title: 'Rule' }
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const organizationId = await activeOrganizationId()
    return <RuleDetails key={`${organizationId}:${id}`} id={id} organizationId={organizationId || ''} />
}
