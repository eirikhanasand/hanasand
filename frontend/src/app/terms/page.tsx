import type { Metadata } from 'next'
import LegalPage from '@/components/legal/legalPage'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Terms of use',
    description: 'Terms of use for Hanasand monitoring, API, alerting, webhooks, and customer console access.',
    path: '/terms',
})

export default function TermsPage() {
    return (
        <LegalPage
            eyebrow='Terms'
            title='Terms of use'
            description='Effective July 3, 2026. These terms govern access to Hanasand services, including monitoring, alerting, API, webhook, and customer console features.'
            sections={[
                {
                    title: '1. Agreement and order of documents',
                    body: [
                        'These Terms of Use form a binding agreement between Hanasand and the organization or person accessing the service. If you use Hanasand on behalf of a company, public body, or other organization, you confirm that you have authority to bind that organization.',
                        'A signed order form, data processing agreement, security addendum, or other written agreement with Hanasand controls over these Terms where it expressly conflicts. Otherwise, these Terms apply to all use of the service.',
                    ],
                },
                {
                    title: '2. The service',
                    body: 'Hanasand provides threat intelligence, exposure monitoring, alert routing, API access, webhooks, dashboards, and related operational tools. The service is designed to help customers identify, review, and route external risk signals; it is not a substitute for legal, incident response, insurance, or law enforcement advice.',
                },
                {
                    title: '3. Customer accounts and administration',
                    body: 'Customers are responsible for their users, administrators, credentials, API keys, webhook endpoints, watchlists, notification routes, and account configuration. You must keep credentials confidential, use reasonable access controls, and promptly notify Hanasand if you suspect unauthorized access or need an endpoint disabled.',
                    bullets: [
                        'Administrators may invite users, assign roles, configure integrations, and remove access.',
                        'You are responsible for activity under your account unless caused by Hanasand\'s breach of these Terms.',
                        'Hanasand may rely on instructions from an account administrator unless it has reason to believe the request is unauthorized or unlawful.',
                    ],
                },
                {
                    title: '4. Permitted use',
                    body: 'You may use the service only for lawful security, risk, compliance, fraud, vendor, brand, domain, and operational monitoring purposes. You are responsible for ensuring that your use of alerts, exports, watchlists, searches, and integrations complies with laws and policies that apply to you.',
                },
                {
                    title: '5. Prohibited use',
                    body: 'You must not misuse the service or use it in a way that creates legal, security, or platform risk for Hanasand, other customers, monitored sources, or third parties.',
                    bullets: [
                        'Do not use the service to harass, dox, surveil, discriminate against, or unlawfully profile people.',
                        'Do not submit credentials, secrets, malware, exploit payloads, illegal content, or unnecessary sensitive personal data into search fields, watchlists, prompts, or webhook configuration.',
                        'Do not attempt to reverse engineer, bypass rate limits, disrupt, scrape, overload, or gain unauthorized access to Hanasand systems.',
                        'Do not use Hanasand outputs to conduct offensive operations or to access systems, accounts, data, or sources without authorization.',
                        'Do not resell, publish, or redistribute service data as a standalone feed unless Hanasand has agreed in writing.',
                    ],
                },
                {
                    title: '6. Customer data and monitoring inputs',
                    body: [
                        'Customer Data means information you or your users provide to Hanasand, including account details, watch terms, domains, vendors, organizations, webhook endpoints, notes, tickets, API requests, and configuration. As between the parties, you retain ownership of Customer Data.',
                        'You grant Hanasand the rights needed to host, process, secure, transmit, display, analyze, and support Customer Data for the service. Hanasand may also use aggregated or de-identified operational information to maintain, secure, measure, and improve the service, provided it does not identify you or your users.',
                    ],
                },
                {
                    title: '7. Threat intelligence sources and alert review',
                    body: [
                        'Hanasand monitors external sources that may change, disappear, become unavailable, or require human review. Alerts may include metadata, source references, confidence signals, summaries, timestamps, and suggested next steps. Not every alert will be complete, current, or actionable.',
                        'Customers are responsible for reviewing alerts before taking action. Hanasand does not represent that a monitored item proves compromise, breach, attribution, criminal conduct, sanctions exposure, or legal liability.',
                    ],
                },
                {
                    title: '8. Integrations, webhooks, and customer systems',
                    body: 'If you connect Hanasand to Slack, Discord, email, ticketing systems, SIEMs, webhooks, internal tools, or other destinations, you are responsible for those systems and for the information sent to them. You must have the right to configure each destination and must keep endpoint secrets, signing keys, and delivery credentials secure.',
                },
                {
                    title: '9. API use and rate limits',
                    body: 'Hanasand may provide API access subject to authentication, documented limits, fair use controls, and security review. Hanasand may throttle, suspend, or reject requests that threaten service stability, exceed purchased capacity, appear abusive, or violate these Terms.',
                },
                {
                    title: '10. Security',
                    body: 'Hanasand uses administrative, technical, and organizational safeguards designed to protect the service. No internet service can be made risk-free. Customers remain responsible for securing their own networks, devices, identities, webhook destinations, and downstream systems.',
                },
                {
                    title: '11. Confidentiality',
                    body: 'Each party may receive non-public business, technical, security, pricing, product, customer, or operational information from the other. The receiving party must protect that information with reasonable care and use it only for the relationship contemplated by these Terms. Confidentiality obligations do not apply to information that is public, independently developed, lawfully received from another source, or required to be disclosed by law after reasonable notice where permitted.',
                },
                {
                    title: '12. Fees, taxes, and renewals',
                    body: 'Fees, billing periods, usage allowances, payment terms, taxes, renewal terms, and cancellation rights are stated in the applicable order, checkout flow, invoice, or written agreement. Unless the applicable agreement says otherwise, fees are non-refundable except where required by law or where Hanasand materially fails to provide the purchased service and does not cure the failure within a reasonable time.',
                },
                {
                    title: '13. Intellectual property',
                    body: [
                        'Hanasand and its licensors retain all rights in the service, software, models, designs, workflows, documentation, source connectors, dashboards, APIs, and other technology. Except for the limited right to use the service during the subscription term, no rights are transferred to you.',
                        'If you send feedback or suggestions, Hanasand may use them without restriction or obligation to you, provided Hanasand does not disclose your confidential information.',
                    ],
                },
                {
                    title: '14. Third-party services and materials',
                    body: 'The service may reference or integrate with third-party sources, infrastructure, APIs, identity providers, messaging systems, or cloud services. Hanasand is not responsible for third-party services outside its control. Third-party terms may apply to your use of those services.',
                },
                {
                    title: '15. Beta and preview features',
                    body: 'Hanasand may offer beta, preview, experimental, or limited-availability features. Those features may change, be discontinued, have limited support, or produce incomplete results. Unless a written agreement says otherwise, beta features are provided as-is and should not be used for production-critical decisions without independent review.',
                },
                {
                    title: '16. Suspension',
                    body: 'Hanasand may suspend access to all or part of the service if it reasonably believes that continued access may violate law, compromise security, harm the service, expose another customer, exceed purchased rights, or violate these Terms. When practical and lawful, Hanasand will provide notice and a chance to resolve the issue.',
                },
                {
                    title: '17. Disclaimers',
                    body: 'Except as expressly stated in a written agreement, the service is provided on an as-is and as-available basis. Hanasand disclaims warranties of merchantability, fitness for a particular purpose, non-infringement, and uninterrupted or error-free operation. Hanasand does not guarantee that monitoring will detect every relevant source, alert, exposure, credential, actor mention, breach, or operational event.',
                },
                {
                    title: '18. Limitation of liability',
                    body: 'To the maximum extent permitted by law, neither party will be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost revenue, lost goodwill, business interruption, or loss of data. Except for payment obligations, confidentiality breaches, misuse of intellectual property, or liabilities that cannot legally be limited, each party\'s total liability for claims arising from the service is limited to the amounts paid or payable to Hanasand for the service during the twelve months before the event giving rise to the claim.',
                },
                {
                    title: '19. Indemnity',
                    body: 'You will defend and indemnify Hanasand against third-party claims arising from your Customer Data, your unlawful use of the service, your integrations, or your violation of these Terms. Hanasand will defend and indemnify you against third-party claims alleging that the service, as provided by Hanasand and used as permitted, infringes intellectual property rights. The indemnified party must promptly notify the other party, provide reasonable cooperation, and allow the indemnifying party to control the defense, provided no settlement may admit fault or impose obligations without consent.',
                },
                {
                    title: '20. Term and termination',
                    body: 'These Terms apply while you access or use the service. Either party may terminate as stated in the applicable order or written agreement. Hanasand may terminate access for material breach if the breach is not cured within a reasonable period after notice, or immediately where cure is not practical because of legal, security, or abuse risk.',
                },
                {
                    title: '21. Export, sanctions, and restricted parties',
                    body: 'You must comply with applicable export control, sanctions, anti-corruption, and restricted-party rules. You may not use the service where prohibited by law or for the benefit of a sanctioned person, organization, or jurisdiction.',
                },
                {
                    title: '22. Changes to these Terms',
                    body: 'Hanasand may update these Terms from time to time. Material changes will be posted on this page or communicated through reasonable channels. Changes apply prospectively. If a change materially reduces your rights during a paid subscription term, you may stop using the affected service and contact Hanasand to discuss the applicable order.',
                },
                {
                    title: '23. Governing law and disputes',
                    body: 'Unless a written agreement states otherwise, these Terms are governed by the laws of Norway, without regard to conflict-of-law rules. The parties will first try to resolve disputes in good faith through business escalation. If that fails, disputes will be resolved in the courts of Norway, except that either party may seek urgent injunctive relief in any court with jurisdiction.',
                },
                {
                    title: '24. Contact',
                    body: 'Questions about these Terms, security concerns, account access, or contract notices may be sent through Hanasand support. Notices should identify the customer organization, the relevant account or order, and the issue requiring review.',
                },
            ]}
        />
    )
}
