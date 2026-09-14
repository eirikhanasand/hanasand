import RuleDetails from './rule-details'

export const metadata = { title: 'Detection rule' }
export const dynamic = 'force-dynamic'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ organizationId?: string }> }) {
    const { id } = await params
    const { organizationId } = await searchParams
    return <RuleDetails key={`${organizationId}:${id}`} id={id} organizationId={organizationId || ''} />
}
