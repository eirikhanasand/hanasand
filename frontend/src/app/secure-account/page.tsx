import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import SecureAccountPage from './pageClient'

export const metadata: Metadata = {
    ...buildRouteMetadata({
        title: 'Secure your account',
        description: 'Lock your Hanasand account after an unrecognized password change.',
        path: '/secure-account',
        keywords: ['hanasand secure account'],
    }),
    robots: { index: false, follow: false },
}

export default function Page() {
    return <SecureAccountPage />
}
