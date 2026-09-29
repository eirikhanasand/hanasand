import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import ResetPasswordAgainPage from './pageClient'

export const metadata: Metadata = {
    ...buildRouteMetadata({
        title: 'Reset your password',
        description: 'Start a new password reset for your Hanasand account.',
        path: '/reset-password-again',
        keywords: ['hanasand password reset'],
    }),
    robots: { index: false, follow: false },
}

export default function Page() {
    return <ResetPasswordAgainPage />
}
