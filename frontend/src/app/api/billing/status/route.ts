import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'

export async function GET(request: NextRequest) {
    return proxyOrganizationApiRequest(request, '/billing/subscription', { method: 'GET' })
}
