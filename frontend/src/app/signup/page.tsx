import LoginPage from '../login/pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Sign up',
    description: 'Create your Hanasand account.',
    path: '/signup',
})

export default async function Page({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const path = (Array.isArray(params.path) ? params.path[0] : params.path) || null
    return <LoginPage initialMode='signup' path={path} serverInternal={false} serverExpired={false}
        serverError={typeof params.error === 'string' ? params.error.slice(0, 500) : undefined} />
}
