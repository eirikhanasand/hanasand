import type { Metadata } from 'next'
import LegalPage from '@/components/legal/legalPage'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Privacy policy',
    description: 'Privacy policy for Hanasand accounts, monitoring inputs, alerts, API use, webhooks, and support activity.',
    path: '/privacy',
})

export default function PrivacyPage() {
    return (
        <LegalPage
            eyebrow='Privacy'
            title='Privacy policy'
            description='Effective July 3, 2026. This policy explains how Hanasand handles customer account data, monitoring inputs, alert records, API activity, webhook configuration, and support information.'
            sections={[
                {
                    title: '1. Who this policy covers',
                    body: 'This Privacy Policy applies to Hanasand websites, customer consoles, APIs, monitoring products, alert workflows, webhook delivery, support channels, and related services. It applies to visitors, account users, administrators, API users, and customer representatives.',
                },
                {
                    title: '2. Information customers provide',
                    body: 'Customers and users may provide account details, organization names, administrator and user information, watched terms, domains, vendors, webhook endpoints, notification settings, support requests, billing and commercial information, uploaded notes, and other content submitted through the service.',
                },
                {
                    title: '3. Monitoring inputs and alert data',
                    body: [
                        'Hanasand processes watchlists, company names, domains, vendor names, actor queries, source selections, alert rules, and related configuration so the service can monitor external risk signals and route alerts.',
                        'Alert records may include source names, timestamps, confidence signals, matched terms, summaries, metadata, workflow status, delivery status, analyst notes, and customer-selected routing information. Customers should review alerts before taking action because monitored sources can be incomplete, unavailable, stale, or disputed.',
                    ],
                },
                {
                    title: '4. Account, authentication, and console data',
                    body: 'Hanasand processes account identifiers, role assignments, session state, access tokens, API keys, audit events, and console activity to authenticate users, enforce permissions, maintain security, support administrators, and operate protected product pages.',
                },
                {
                    title: '5. API, webhook, and integration data',
                    body: 'When customers use APIs, webhooks, email, ticketing, chat, SIEM, or other integrations, Hanasand may process request details, endpoint configuration, delivery payloads, response status, retry state, signing or authentication details, and diagnostic logs needed to deliver and verify the integration.',
                },
                {
                    title: '6. Technical and usage information',
                    body: 'Hanasand collects operational information such as IP address, browser and device details, route accessed, timestamps, request IDs, error messages, latency, feature usage, security events, and service logs. This information helps operate, secure, debug, measure, and improve the service.',
                },
                {
                    title: '7. How Hanasand uses information',
                    body: 'Hanasand uses information to provide the service, authenticate users, route alerts, deliver webhooks, support customer workflows, maintain source and parser quality, enforce permissions, prevent abuse, secure infrastructure, troubleshoot incidents, comply with law, bill for services, and communicate about product or account matters.',
                    bullets: [
                        'To deliver alerts, search results, API responses, notifications, and dashboard views requested by the customer.',
                        'To maintain audit trails, security controls, rate limits, fraud prevention, and support workflows.',
                        'To improve reliability, source quality, parser confidence, product usability, and operational performance.',
                    ],
                },
                {
                    title: '8. Legal bases where applicable',
                    body: 'Where privacy law requires a legal basis, Hanasand relies on performance of a contract, legitimate interests in operating and securing the service, compliance with legal obligations, and consent where the service specifically asks for it. Customers are responsible for having an appropriate basis for the monitoring inputs and contact information they submit.',
                },
                {
                    title: '9. Customer control and administrator responsibility',
                    body: 'Customer administrators control users, roles, watchlists, monitored terms, integrations, and delivery destinations. Customers are responsible for deciding what information to submit, who may access it, and which downstream systems receive alert or webhook content.',
                },
                {
                    title: '10. Sharing and subprocessors',
                    body: 'Hanasand may share information with service providers that host, secure, support, analyze, or deliver the service, including cloud infrastructure, email, logging, database, authentication, payment, support, and communications providers. Hanasand does not sell Customer Data as a standalone data feed. Information may also be disclosed when required by law, to protect rights or security, or as part of a corporate transaction.',
                },
                {
                    title: '11. International processing',
                    body: 'Hanasand may process information in countries where Hanasand, its infrastructure, or service providers operate. Where required, Hanasand uses appropriate transfer mechanisms and contractual controls for international processing.',
                },
                {
                    title: '12. Retention',
                    body: 'Hanasand keeps information for as long as needed to provide the service, meet contractual commitments, maintain security and audit records, resolve disputes, comply with law, and support business operations. Retention periods vary by data type, customer configuration, legal requirement, and operational need.',
                },
                {
                    title: '13. Security',
                    body: 'Hanasand uses administrative, technical, and organizational safeguards designed to protect information. These include access controls, authentication, logging, network and application controls, operational review, and limited access based on business need. No system is perfectly secure, and customers should protect their own accounts, webhook endpoints, devices, and downstream tools.',
                },
                {
                    title: '14. Privacy rights',
                    body: 'Depending on location and role, individuals may have rights to access, correct, delete, export, restrict, or object to certain processing. For information controlled by a Hanasand customer, requests should usually be directed to that customer. Hanasand will assist customers with reasonable privacy requests where required by law or contract.',
                },
                {
                    title: '15. Children',
                    body: 'Hanasand is a business service and is not intended for children. Customers must not knowingly submit information about children unless they have a lawful basis and the information is necessary for the configured service.',
                },
                {
                    title: '16. Changes to this policy',
                    body: 'Hanasand may update this Privacy Policy as the service, law, or operating practices change. Material updates will be posted on this page or communicated through reasonable channels. The effective date above shows when the current version took effect.',
                },
                {
                    title: '17. Contact',
                    body: 'Privacy questions, rights requests, security concerns, and contract notices may be sent through Hanasand support. Please identify the customer organization, the relevant account or integration, and the information involved so Hanasand can route the request correctly.',
                },
            ]}
        />
    )
}
