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
                ['Monitoring boundary', 'Metadata-first collection and safe alert fields', '/dwm and /ti'],
                ['Certifications', 'No SOC 2 or ISO 27001 certification today', '/trust'],
            ],
        },
        nextSteps: [
            'Request the procurement review if you need a questionnaire answered against a specific deployment.',
            'Raise SSO, SCIM, retention, regional hosting, and support-response requirements before pilot approval.',
            'Do not treat this overview as a SOC 2, ISO 27001, or penetration-test report.',
        ],
    },
    {
        slug: 'dpa-and-data',
        label: 'Data processing overview',
        eyebrow: 'Data processing review',
        title: 'Data processing notes for security and legal review.',
        description: 'A buyer-readable review of data categories, retention boundaries, transfer questions, and breach-notification routing. This is not an executed data processing agreement.',
        status: 'Public review copy',
        updated: 'July 22, 2026',
        summary: [
            ['Contract status', 'No public standard DPA is offered today; signed processing terms require a written agreement.'],
            ['Customer data', 'Watchlists, alert records, user/account data, webhook settings, and support context.'],
            ['Raw leak material', 'Not required for the default alerting workflow.'],
            ['Deletion/export', 'Watchlist alert-term export exists; broader customer-data export and deletion are handled through support.'],
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
                body: 'Organization settings store a retention period, but automated lifecycle enforcement for every customer record is not claimed as generally available. A production order must identify the records in scope, the deletion mechanism, legal-hold handling, and the evidence used to verify enforcement.',
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
            'Send jurisdiction, required DPA template, vendor portal, and deadline through /contact?intent=procurement.',
            'Do not approve production until retention, deletion, audit-log, and regional hosting requirements are written and technically verified.',
            'Execute a signed DPA or equivalent processing terms before processing sensitive customer watchlists at scale.',
        ],
    },
    {
        slug: 'subprocessors',
        label: 'Subprocessors',
        eyebrow: 'Subprocessor register',
        title: 'Current service-provider and integration categories.',
        description: 'A public category-level inventory of systems that may support Hanasand delivery. It is not a complete named subprocessor register.',
        status: 'Category inventory',
        updated: 'July 22, 2026',
        summary: [
            ['Default posture', 'Hanasand-operated container services and database storage for the core product.'],
            ['External processors', 'Limited to hosting/runtime, mail, billing, alert processing, and customer-selected integrations where configured.'],
            ['Customer control', 'Webhook, SIEM/SOAR, ticketing, and chat destinations are customer-selected.'],
            ['Provider details', 'Named providers and regions must be supplied and approved for each production deployment.'],
        ],
        sections: [
            {
                title: 'Why the register is scoped',
                body: 'The product can run with a mostly self-hosted stack. Some customers may use invoice-only billing, customer-managed deployments, or their own downstream integrations. This page does not substitute for a named provider, legal entity, processing location, and transfer-mechanism list for the production deployment.',
            },
            {
                title: 'Customer-selected destinations',
                body: 'When a customer configures a webhook or API consumer for SIEM, SOAR, ticketing, chat, or an internal tool, that customer-owned system receives the alert payloads the customer chooses to route.',
            },
        ],
        table: {
            columns: ['Category', 'Purpose', 'Current disclosure'],
            rows: [
                ['Hosting/runtime', 'Application, API, worker, processing, Tor/onion session, and scheduled-job infrastructure', 'Hanasand-managed deployment; named infrastructure provider and region are not published here'],
                ['Database/storage', 'Account, organization, watchlist, alert, audit, and operational state', 'PostgreSQL-backed storage in the deployment environment'],
                ['Mail', 'Account recovery, commercial requests, support, and operational messages', 'Hanasand mail stack or configured mail provider by deployment; monitoring alerts use webhook, case, and API paths'],
                ['Alert processing', 'Structure source records into safer alert fields when enabled', 'Hanasand-controlled model endpoint or explicitly approved provider'],
                ['Billing/payment', 'Subscriptions, invoices, and plan administration', 'Only used when the customer is not handled by invoice/order form'],
                ['Customer integrations', 'Webhook/API delivery to customer tools', 'Customer-selected destination receives customer-approved alert payloads'],
            ],
        },
        nextSteps: [
            'Require the named provider, legal entity, hosting region, and transfer details for the target deployment.',
            'List any prohibited subprocessors before procurement approval.',
            'Confirm whether you need customer-managed deployment, invoice-only billing, or restricted integration routing.',
        ],
    },
    {
        slug: 'sla-onboarding',
        label: 'Support and onboarding',
        eyebrow: 'Enterprise onboarding',
        title: 'Pilot-to-production path, support terms, and current identity gaps.',
        description: 'A practical onboarding outline for security teams. Hanasand publishes measured service history, but no standard contractual SLA or credit schedule today.',
        status: 'No published SLA',
        updated: 'July 22, 2026',
        summary: [
            ['Pilot path', 'Watchlist, delivery route, reviewer, and success criteria.'],
            ['Support terms', 'No standard response-time commitment or service-credit schedule is published today.'],
            ['Identity', 'Roles and organization admin today; SSO/SCIM scoped before rollout.'],
            ['Procurement', 'Security questions and contract requirements use the durable procurement intake path.'],
        ],
        sections: [
            {
                title: 'Recommended pilot sequence',
                body: 'Start with a narrow watchlist and a clear reviewer. Verify source context, alert fields, delivery route, false-positive handling, and escalation before expanding to a larger supplier or portfolio program.',
                items: [
                    'Week 0: security/procurement review, watchlist shape, delivery route, and reviewer named.',
                    'Week 1: first watchlist added, alert reviewed, and webhook/API/case delivery checked.',
                    'Weeks 2-3: tune watched names, severity expectations, suppression, and escalation owners.',
                    'Week 4: decide whether coverage and workflow are strong enough for paid production use.',
                ],
            },
            {
                title: 'Support and SLA',
                body: 'The public status page reports measured service history. It is a service record, not a contractual uptime promise. Any support hours, response targets, incident notification windows, maintenance notices, or service credits must be explicit in a signed order; none are standard or generally available today.',
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
                    'Delivery route: webhook, API, case workflow, customer-owned downstream integration, review link, or manual reporting.',
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
                ['Support/SLA', 'No published standard commitment', 'Write response targets, notification window, exclusions, and credits into the signed order'],
                ['SSO/SCIM', 'Scoped deal, not generally available', 'Decide whether rollout depends on implementation'],
            ],
        },
        nextSteps: [
            'Use /contact?intent=procurement to send vendor portal, identity requirements, and proposed support targets.',
            'Start with a watchlist small enough to manually review every alert during the pilot.',
            'Do not approve a broad rollout until SSO, retention, delivery, and escalation requirements are contractually clear.',
        ],
    },
]

export function getTrustArtifact(slug: string) {
    return trustArtifacts.find((artifact) => artifact.slug === slug)
}
