import type { Metadata } from 'next'
import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import OrganizationWorkspaceClient, { type OrganizationSummary } from './organizationWorkspaceClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Organizations | Hanasand',
    description: 'Manage organizations, members, shared watchlists, alert scope, cases, and webhook destinations.',
}

export default async function Page() {
    const response = await proxyOrganizationApiRequest(new NextRequest('http://localhost/api/organizations'), '/organizations', { method: 'GET' })
    const payload = response.ok ? await response.json() as { organizations?: OrganizationSummary[] } : null
    return <OrganizationWorkspaceClient initialOrganizations={payload ? payload.organizations || [] : undefined} />
}
