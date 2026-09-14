import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ org?: string, organizationId?: string, orgId?: string }> }) {
    const params = await searchParams
    const organizationId = params.org || params.organizationId || params.orgId
    redirect(`/cases${organizationId ? `?org=${encodeURIComponent(organizationId)}` : ''}`)
}
