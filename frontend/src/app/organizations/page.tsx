import type { Metadata } from 'next'
import OrganizationWorkspaceClient from './organizationWorkspaceClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Organizations | Hanasand',
    description: 'Manage organizations, members, shared watchlists, alert scope, cases, and webhook destinations.',
}

export default function Page() {
    return <OrganizationWorkspaceClient />
}
