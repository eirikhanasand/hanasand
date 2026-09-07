import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { GET as getOpenApi } from './ti/route'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'OpenAPI JSON | Hanasand' }

export default async function OpenApiPage() {
    const session = await cookies()
    if (!session.get('id')?.value || !session.get('access_token')?.value) redirect('/logout?path=/login%3Fpath%3D/api/openapi%26expired=true')
    const response = await getOpenApi()
    const document = response.ok ? await response.json() : null

    return <DashboardPage className='min-w-0'>
        <header className='flex flex-wrap items-center justify-between gap-3'>
            <div>
                <Link href='/api' className='text-xs font-semibold text-ui-primary hover:underline'>API docs</Link>
                <h1 className='mt-1 text-xl font-semibold'>OpenAPI JSON</h1>
            </div>
            <Link prefetch={false} href='/api/openapi/ti' target='_blank' rel='noopener noreferrer' aria-label='Open raw JSON in a new tab' title='Open raw JSON in a new tab' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>
                Raw JSON <ArrowUpRight className='h-4 w-4' aria-hidden='true' />
            </Link>
        </header>
        <DashboardPanel className='min-w-0 overflow-hidden'>
            {document ? <pre className='overflow-x-auto p-4 text-xs leading-6 text-ui-text' aria-label='OpenAPI specification'><code>{JSON.stringify(document, null, 2)}</code></pre> : <p role='alert' className='p-4 text-sm text-ui-danger'>The OpenAPI document is temporarily unavailable. Reload this page to try again.</p>}
        </DashboardPanel>
    </DashboardPage>
}
