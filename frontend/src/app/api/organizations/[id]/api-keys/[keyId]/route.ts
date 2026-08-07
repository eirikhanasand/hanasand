import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string, keyId: string }> }) {
    const { id, keyId } = await context.params
    return proxyOrganizationApiRequest(request, `/organizations/${encodeURIComponent(id)}/api-keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' })
}
