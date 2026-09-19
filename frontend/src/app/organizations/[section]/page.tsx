import { notFound } from 'next/navigation'
import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { organizationPages } from '@/utils/organizations/pages'
import OrganizationWorkspaceClient, { type OrganizationSummary } from '../organizationWorkspaceClient'
export const dynamic = 'force-dynamic'
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
    const { section } = await params
    const page = organizationPages.find(item => item.id === section)
    if (!page) notFound()
    const response = await proxyOrganizationApiRequest(new NextRequest('http://localhost/api/organizations'), '/organizations', { method: 'GET' })
    const payload = response.ok ? await response.json() as { organizations?: OrganizationSummary[] } : null
    return <OrganizationWorkspaceClient page={page.id} initialOrganizations={payload ? payload.organizations || [] : undefined} />
}
