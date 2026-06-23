import ResetPasswordPage from './pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Reset Password',
    description: 'Reset access to your Hanasand account.',
    path: '/reset-password',
    keywords: ['hanasand password reset'],
})

export default async function Page(props: { searchParams: Promise<{ id?: string, token?: string }> }) {
    const searchParams = await props.searchParams
    return <ResetPasswordPage userId={searchParams.id || ''} />
}
