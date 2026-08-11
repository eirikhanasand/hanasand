import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'

export async function POST(request: NextRequest) {
    return proxyOrganizationApiRequest(request, '/billing/portal', { method: 'POST' })
}
