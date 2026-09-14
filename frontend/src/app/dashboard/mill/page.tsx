import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
    const { organizationId } = await searchParams
    redirect(`/cases${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`)
}
