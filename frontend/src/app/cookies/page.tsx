import type { Metadata } from 'next'
import LegalPage from '@/components/legal/legalPage'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Cookie policy',
    description: 'Cookie policy for Hanasand authentication, consent, console continuity, integrations, and local browser storage.',
    path: '/cookies',
})

export default function CookiesPage() {
    return (
        <LegalPage
            eyebrow='Cookies'
            title='Cookie policy'
            description='Effective July 3, 2026. This policy explains how Hanasand uses cookies and local browser storage across the public website, customer console, API setup flows, and monitoring workflows.'
            sections={[
                {
                    title: '1. What cookies are',
                    body: 'Cookies are small text values stored by the browser. Similar browser storage, such as local storage, can remember product state without sending every value back to the server on each request. Hanasand uses these technologies to keep the service secure, usable, and consistent.',
                },
                {
                    title: '2. Required cookies',
                    body: 'Required cookies support login, session continuity, role checks, impersonation safeguards where enabled, CSRF and security behavior, protected route access, and basic routing. These cookies are necessary for account and console use and cannot be disabled from cookie settings without signing out or losing access to protected pages.',
                },
                {
                    title: '3. Preference cookies',
                    body: 'Preference cookies remember interface choices such as visual theme or similar display state. These choices are controlled from the relevant product interface rather than the cookie settings page so the setting stays close to the feature it changes.',
                },
                {
                    title: '4. Consent and notice cookies',
                    body: 'Hanasand may store a lightweight consent or notice cookie to remember whether a visitor accepted optional cookies, chose essential-only use, or reset preferences. This avoids asking the same question on every page load.',
                },
                {
                    title: '5. Analytics and product improvement',
                    body: 'Hanasand may use privacy-conscious analytics or product measurement to understand route health, feature usage, conversion paths, reliability, and error rates. Where required, these cookies or similar technologies are optional and can be changed from cookie settings.',
                },
                {
                    title: '6. Local browser storage',
                    body: 'Some product flows use browser storage for convenience, such as share workspace state, request drafts, design notes, setup drafts, active conversation identifiers, detached panel state, or load-test client identifiers. These values are kept in the browser and can be cleared from cookie settings or browser settings.',
                },
                {
                    title: '7. Third-party cookies',
                    body: 'Hanasand may link to or integrate with third-party services such as payment, support, identity, email, webhook destinations, chat, or developer tooling. Those services may set their own cookies when customers interact with them. Hanasand does not control third-party cookie practices outside the Hanasand service.',
                },
                {
                    title: '8. Managing cookies',
                    body: 'You can manage optional consent and clear product-local browser tokens from Cookie Settings. Browser settings can also delete cookies and storage. Deleting required account cookies will sign you out or interrupt protected console workflows.',
                },
                {
                    title: '9. Changes to this policy',
                    body: 'Hanasand may update this Cookie Policy as the product, integrations, or legal requirements change. The effective date above shows when the current version took effect.',
                },
            ]}
        />
    )
}
