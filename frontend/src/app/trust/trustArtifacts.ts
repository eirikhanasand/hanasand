export type TrustArtifact = {
    slug: string
    label: string
    eyebrow: string
    title: string
    description: string
    status: string
    updated: string
    summary: Array<[string, string]>
    sections: Array<{
        title: string
        body: string
        items?: string[]
    }>
    table?: {
        columns: [string, string, string]
        rows: Array<[string, string, string]>
    }
    nextSteps: string[]
}

export const trustArtifacts: TrustArtifact[] = [
    {
        slug: 'security-overview',
        label: 'Security overview',
        eyebrow: 'Security overview',
        title: 'How Hanasand protects monitoring data today.',
        description: 'A plain-language security overview for vendor review. It separates current controls from controls that still require enterprise scoping.',
        status: 'Published',
        updated: 'July 3, 2026',
        summary: [
            ['Data model', 'Metadata-first alerting; raw leak material is not the normal customer workflow.'],
            ['Access model', 'Organization membership, role checks, admin workflows, and protected dashboard routes.'],
            ['Identity', 'Password accounts today; SSO/SAML/OIDC/SCIM is scoped before enterprise rollout.'],
            ['Certification', 'No SOC 2 or ISO 27001 certificate is claimed.'],
        ],
        sections: [
            {
                title: 'Customer data handled',
                body: 'Hanasand stores the information needed to monitor watched companies and route alerts: organization identifiers, watchlist terms, user roles, webhook destinations, alert records, delivery status, and operational audit context.',
                items: [
                    'Watch terms can include company names, domains, suppliers, brands, executives, aliases, and portfolio companies.',
                    'Alert records can include matched term, actor/company fields, source name, timestamps, confidence labels, status, delivery result, and analyst notes.',
                    'Operational telemetry can include request IDs, route health, error state, rate-limit events, audit events, and service logs.',
                ],
            },
            {
                title: 'Safety boundary',
                body: 'The default buyer workflow is intentionally metadata-first. Customers should not need to upload raw leak dumps, malware, production credentials, or unnecessary personal data to receive company exposure alerts.',
            },
            {
                title: 'Access controls',
                body: 'Protected dashboard routes require authentication. Organization pages use member/role context for shared watchlists, alert scope, webhook destinations, and admin workflows. Enterprise identity requirements should be raised before purchase so SSO and provisioning scope are explicit.',
            },
            {
                title: 'Operational controls',
                body: 'The product exposes status, delivery history, admin/support flows, and operational checks where the backing services are enabled. Security reviewers should verify the exact controls in the target deployment before relying on them for policy.',
            },
        ],
        table: {
            columns: ['Control area', 'Current state', 'Evidence path'],
            rows: [
                ['Authentication', 'Password accounts and protected dashboard routes', '/login, /register, protected dashboard routes'],
                ['Organization administration', 'Members, roles, watchlists, and alert scope exist in product surfaces', '/organizations and dashboard organization APIs'],
                ['Webhook delivery', 'Destinations, delivery state, and lifecycle APIs are represented', '/developers and dashboard automation routes'],
                ['Monitoring boundary', 'Metadata-first collection and safe alert fields', '/solutions/dwm and /ti'],
                ['Certifications', 'No SOC 2 or ISO 27001 certification today', '/trust'],
            ],
        },
        nextSteps: [
            'Request the procurement packet if you need a questionnaire answered against a specific deployment.',
            'Raise SSO, SCIM, retention, regional hosting, and support-response requirements before pilot approval.',
            'Do not treat this overview as a SOC 2, ISO 27001, or penetration-test report.',
        ],
    },
    {
        slug: 'dpa-and-data',
        label: 'DPA and data handling',
        eyebrow: 'DPA readiness',
        title: 'Data processing notes for security and legal review.',
        description: 'A buyer-readable preview of data categories, retention posture, transfer questions, and breach-notification routing. A signed DPA is still handled by request.',
        status: 'DPA available on request',
        updated: 'July 3, 2026',
        summary: [
            ['Signed DPA', 'Available by request for paid pilots and enterprise review.'],
            ['Customer data', 'Watchlists, alert records, user/account data, webhook settings, and support context.'],
            ['Raw leak material', 'Not required for the default alerting workflow.'],
            ['Deletion/export', 'Handled through account, support, or contract path today.'],
        ],
        sections: [
            {
                title: 'Processing role',
                body: 'For customer-configured monitoring, Hanasand generally acts as a service provider/processor for customer watchlists, account data, alert routing, and delivery settings. Some public threat-intelligence source records may be processed as Hanasand operational data.',
            },
            {
                title: 'Data categories',
                body: 'The service can process business contact details, organization membership, watchlist terms, source records, alert records, webhook endpoints, API keys, support messages, audit events, and operational logs.',
            },
            {
                title: 'Retention posture',
                body: 'Retention depends on plan, deployment, and contract. Default product data is kept while needed to provide monitoring, support, security, dispute resolution, auditability, and legal compliance. Enterprise customers should set alert retention, audit retention, and deletion expectations in the order/DPA.',
            },
            {
                title: 'Incident and breach notification',
                body: 'Security concerns are routed through support/procurement channels with customer, system, and timeline details. Contracted notification windows should be agreed in the DPA or order form before production use.',
            },
        ],
        table: {
            columns: ['Data type', 'Purpose', 'Default handling'],
            rows: [
                ['Watchlist terms', 'Match company, supplier, domain, brand, and executive exposure', 'Stored as customer monitoring configuration'],
                ['Alert records', 'Show what matched, source context, status, and delivery result', 'Stored as reviewable product records'],
                ['Webhook/API data', 'Deliver alerts into customer workflows', 'Scoped to configured destination and delivery history'],
                ['Support/procurement data', 'Answer review, onboarding, billing, and security questions', 'Handled through contact/support path'],
                ['Raw leak material', 'Not required for normal company exposure alerting', 'Excluded unless explicitly approved and scoped'],
            ],
        },
        nextSteps: [
            'Send jurisdiction, template DPA, vendor portal, and deadline through /contact?intent=procurement.',
            'Specify retention, deletion, audit-log, and regional hosting expectations before a production rollout.',
            'Ask for a signed DPA/order form before processing sensitive customer watchlists at scale.',
        ],
    },
    {
        slug: 'subprocessors',
        label: 'Subprocessors',
        eyebrow: 'Subprocessor register',
        title: 'Current service-provider and integration categories.',
        description: 'A public register of the systems that may support Hanasand delivery. Exact provider names and regions are confirmed in the DPA/order form for the target deployment.',
        status: 'Published by category',
        updated: 'July 3, 2026',
        summary: [
            ['Default posture', 'Hanasand-operated container services and database storage for the core product.'],
            ['External processors', 'Limited to hosting/runtime, mail, billing, alert processing, and customer-selected integrations where configured.'],
            ['Customer control', 'Webhook, SIEM/SOAR, ticketing, and chat destinations are customer-selected.'],
            ['Provider details', 'Named providers and regions are confirmed for each contracted deployment.'],
        ],
        sections: [
            {
                title: 'Why the register is scoped',
                body: 'The product can run with a mostly self-hosted stack. Some customers may use invoice-only billing, customer-managed deployments, or their own downstream integrations. Because provider use can change by deployment, the signed packet should identify the exact providers and regions for that customer.',
            },
            {
                title: 'Customer-selected destinations',
                body: 'When a customer configures webhooks, email, SIEM, SOAR, ticketing, Slack/Teams-style destinations, or internal tools, those systems receive the alert payloads the customer chooses to route.',
            },
        ],
        table: {
            columns: ['Category', 'Purpose', 'Current disclosure'],
            rows: [
                ['Hosting/runtime', 'Application, API, worker, processing, Tor/onion session, and scheduled-job infrastructure', 'Hanasand-managed infrastructure; named provider/region supplied in the order/DPA'],
                ['Database/storage', 'Account, organization, watchlist, alert, audit, and operational state', 'PostgreSQL-backed storage in the deployment environment'],
                ['Mail/notification', 'Account, support, operational, and alert email where configured', 'Hanasand mail stack or configured mail provider by deployment'],
                ['Alert processing', 'Structure source records into safer alert fields when enabled', 'Hanasand-controlled model endpoint or explicitly approved provider'],
                ['Billing/payment', 'Subscriptions, invoices, and plan administration', 'Only used when the customer is not handled by invoice/order form'],
                ['Customer integrations', 'Webhook/API delivery to customer tools', 'Customer-selected destination receives customer-approved alert payloads'],
            ],
        },
        nextSteps: [
            'Request named provider, hosting region, and transfer details for the target deployment.',
            'List any prohibited subprocessors before procurement approval.',
            'Confirm whether you need customer-managed deployment, invoice-only billing, or restricted integration routing.',
        ],
    },
    {
        slug: 'sla-onboarding',
        label: 'SLA and onboarding',
        eyebrow: 'Enterprise onboarding',
        title: 'Pilot-to-production path, support terms, and current identity gaps.',
        description: 'A practical onboarding outline for security teams that need procurement, alert delivery, support, and identity requirements clarified before rollout.',
        status: 'Available for pilots',
        updated: 'July 3, 2026',
        summary: [
            ['Pilot path', 'Watchlist, delivery route, reviewer, and success criteria.'],
            ['Support terms', 'Response targets are agreed in order form/SLA for enterprise customers.'],
            ['Identity', 'Roles and organization admin today; SSO/SCIM scoped before rollout.'],
            ['Procurement', 'Security questionnaire, DPA, subprocessors, and SLA notes by request.'],
        ],
        sections: [
            {
                title: 'Recommended pilot sequence',
                body: 'Start with a narrow watchlist and a clear reviewer. Verify source context, alert fields, delivery route, false-positive handling, and escalation before expanding to a larger supplier or portfolio program.',
                items: [
                    'Week 0: security/procurement packet, watchlist shape, delivery route, and reviewer named.',
                    'Week 1: first watchlist added, alert packet reviewed, webhook/API/email delivery checked.',
                    'Weeks 2-3: tune watched names, severity expectations, suppression, and escalation owners.',
                    'Week 4: decide whether coverage and workflow are strong enough for paid production use.',
                ],
            },
            {
                title: 'Support and SLA',
                body: 'Self-serve pilots use lightweight support. Enterprise terms can define support hours, initial response targets, incident notification path, escalation contacts, uptime expectations, and maintenance notice routing.',
            },
            {
                title: 'Admin onboarding',
                body: 'A customer should identify the organization owner, admin users, alert reviewers, webhook/API owner, procurement owner, and security-review owner before production use.',
            },
            {
                title: 'Procurement intake checklist',
                body: 'A review request is actionable when it includes the deployment facts needed to decide fit, contract scope, and launch sequence.',
                items: [
                    'Organization name, buyer owner, security-review owner, and vendor portal or questionnaire link.',
                    'Watched companies, domains, suppliers, portfolio size, and first-month success criteria.',
                    'Delivery route: email, webhook, API, SIEM/SOAR, ticketing, review links, or manual reporting.',
                    'Required identity controls: SSO/SAML/OIDC, SCIM, MFA policy, role model, and offboarding expectations.',
                    'Procurement deadline, DPA jurisdiction, retention expectations, support/SLA targets, and escalation contacts.',
                ],
            },
            {
                title: 'Identity requirements',
                body: 'Password accounts and role-aware organization administration are available today. SSO/SAML/OIDC, SCIM provisioning, MFA policy enforcement, and advanced lifecycle controls are not claimed as generally available and should be scoped before purchase.',
            },
        ],
        table: {
            columns: ['Requirement', 'Current state', 'Decision before rollout'],
            rows: [
                ['Organization owner', 'Admin/member model exists', 'Name the accountable customer admin'],
                ['Alert reviewer', 'Alerts and cases can be routed to product surfaces', 'Name SOC/vendor-risk owner and escalation path'],
                ['Delivery route', 'Email, API, and webhook paths are represented', 'Choose destination and verify payload fields'],
                ['Procurement intake', 'Company is required for enterprise/security review contact requests', 'Send owner, portal, deadline, DPA, identity, retention, and support requirements'],
                ['Support/SLA', 'By request for enterprise terms', 'Agree response targets and notification window'],
                ['SSO/SCIM', 'Scoped deal, not generally available', 'Decide whether rollout depends on implementation'],
            ],
        },
        nextSteps: [
            'Use /contact?intent=procurement to send vendor portal, identity requirements, and support targets.',
            'Start with a watchlist small enough to manually review every alert during the pilot.',
            'Do not approve a broad rollout until SSO, retention, delivery, and escalation requirements are contractually clear.',
        ],
    },
]

export function getTrustArtifact(slug: string) {
    return trustArtifacts.find((artifact) => artifact.slug === slug)
}
