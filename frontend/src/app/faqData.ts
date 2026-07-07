export const faqs = [
    {
        question: 'What is a threat actor?',
        answer: 'A threat actor is a person, group, or organization that carries out cyber activity. In Hanasand, the term usually means a ransomware group, leak-site operator, broker, or criminal crew claiming access to data.',
    },
    {
        question: 'What does Hanasand monitor?',
        answer: 'Hanasand monitors company, vendor, domain, brand, and executive mentions across exposure sources such as leak sites, extortion posts, public threat intelligence, advisories, and analyst-reviewed records.',
    },
    {
        question: 'What counts as a company exposure alert?',
        answer: 'An exposure alert is created when a monitored company, supplier, domain, or related term appears in a source that may indicate leaked data, ransomware activity, credential exposure, or a security-relevant claim.',
    },
    {
        question: 'Does an alert mean the company was breached?',
        answer: 'No. An alert means a source made a relevant claim or mention. Hanasand shows the source, context, data mentioned, confidence, and next review step so an analyst can verify the claim before escalation.',
    },
    {
        question: 'How often is activity refreshed?',
        answer: 'The live activity feed refreshes automatically. Some sources update within minutes, while others depend on source availability, verification, and collection timing.',
    },
    {
        question: 'Can Hanasand monitor vendors and suppliers?',
        answer: 'Yes. Watchlists can include suppliers, portfolio companies, subsidiaries, domains, brands, and executive names so third-party exposure is visible before it becomes a customer issue.',
    },
    {
        question: 'What information is included in an alert?',
        answer: 'A typical alert includes the actor or source, company name, data mentioned, country if available, timing, source context, confidence, and suggested triage action.',
    },
    {
        question: 'What is dark web monitoring?',
        answer: 'Dark web monitoring is the process of watching hard-to-find or restricted sources for mentions of companies, credentials, data sets, actors, and other risk signals.',
    },
    {
        question: 'What is ransomware monitoring?',
        answer: 'Ransomware monitoring tracks groups and leak sites where attackers publish claims about victims, stolen data, negotiations, or planned disclosures.',
    },
    {
        question: 'What is a leak site?',
        answer: 'A leak site is a page or service where an actor publishes victim names, samples, files, or claims intended to pressure organizations or advertise stolen data.',
    },
    {
        question: 'What does "not disclosed by TA" mean?',
        answer: 'It means the threat actor did not disclose that specific detail in the source material. Hanasand preserves that uncertainty instead of inventing missing facts.',
    },
    {
        question: 'Can alerts be sent to our existing tools?',
        answer: 'Yes. Alerts can be routed through webhooks and operational workflows so teams can send findings into Slack, Jira, SIEM, case queues, or internal review systems.',
    },
    {
        question: 'Can we search historical exposure records?',
        answer: 'Yes. The threat intelligence search lets teams look up companies, domains, vendors, groups, source notes, and past exposure records.',
    },
    {
        question: 'How should a team triage a new mention?',
        answer: 'Start by checking whether the source names the correct organization, whether the mentioned records match the business, how fresh the post is, and whether the actor has a history of credible claims.',
    },
    {
        question: 'Does Hanasand replace incident response?',
        answer: 'No. Hanasand provides monitoring, context, and routing. Incident response, legal review, forensics, and customer communication remain the responsibility of the organization and its response partners.',
    },
    {
        question: 'Who is Hanasand for?',
        answer: 'Hanasand is for security teams, founders, managed service providers, portfolio operators, and risk teams that need early visibility into external exposure claims.',
    },
] as const

export const homepageFaqs = faqs.slice(0, 6)
