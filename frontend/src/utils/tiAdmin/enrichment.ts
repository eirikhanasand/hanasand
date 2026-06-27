export type TiEnrichmentStatus = 'ready' | 'running' | 'queued' | 'review'

export type TiEnrichedActor = {
    id: string
    name: string
    aliases: string[]
    status: TiEnrichmentStatus
    confidence: number
    lastUpdatedAt: string
    nextRefreshAt: string
    changedFields: string[]
    sourceLinks: Array<{ name: string, url: string }>
    automationEvidence: string[]
    plannedWork: string[]
}

export type TiActivityEvent = {
    id: string
    actorId: string
    actorName: string
    happenedAt: string
    title: string
    detail: string
    source: string
    tone: 'ok' | 'watch' | 'bad'
}

export type TiManagementAuditEvent = {
    id: string
    happenedAt: string
    actor: string
    action: string
    target: string
    result: string
    detail: string
}

const updatedActors: TiEnrichedActor[] = [
    {
        id: 'apt49',
        name: 'APT49',
        aliases: ['Tropic Trooper', 'BlueHornet', 'AgainstTheWest', 'KeyBoy'],
        status: 'ready',
        confidence: 0.82,
        lastUpdatedAt: '2026-06-27T17:55:00.000Z',
        nextRefreshAt: '2026-06-27T18:55:00.000Z',
        changedFields: ['summary', 'aliases', 'recentActivity', 'targets', 'ttps', 'sources', 'datasets'],
        sourceLinks: [
            { name: 'Aardvark Infinity', url: 'https://medium.com/aardvark-infinity/comprehensive-profile-of-apt49-tropic-trooper-252ba921c46f' },
            { name: 'Malpedia BlueHornet', url: 'https://malpedia.caad.fkie.fraunhofer.de/actor/bluehornet' },
            { name: 'Cyberint BlueHornet', url: 'https://cyberint.com/blog/research/bluehornet-one-apt-to-terrorize-them-all/' },
            { name: 'Google Cloud APT groups', url: 'https://cloud.google.com/security/resources/insights/apt-groups' },
        ],
        automationEvidence: [
            'Matched query apt49 to aliases Tropic Trooper, BlueHornet, AgainstTheWest, and KeyBoy.',
            'Merged curated source links with live reporting and scraper-backed activity rows.',
            'Stored stable profile fields in the API response cache through the rotating background enrichment sweep; recent activity remains short-cache refreshed.',
        ],
        plannedWork: [
            'Monitor for fresh BlueHornet company/leak claims.',
            'Keep Tropic Trooper reporting separate from BlueHornet alias-collision rows.',
            'Promote source-backed campaign TTPs when a new report names tooling or infrastructure.',
        ],
    },
    {
        id: 'apt28',
        name: 'APT28',
        aliases: ['Fancy Bear', 'Sofacy', 'Forest Blizzard'],
        status: 'ready',
        confidence: 0.68,
        lastUpdatedAt: '2026-06-27T17:53:00.000Z',
        nextRefreshAt: '2026-06-27T18:53:00.000Z',
        changedFields: ['targets', 'ttps', 'datasets', 'sources'],
        sourceLinks: [
            { name: 'Google Cloud APT groups', url: 'https://cloud.google.com/security/resources/insights/apt-groups' },
            { name: 'Live reporting query', url: 'https://news.google.com/search?q=Fancy%20Bear%20threat%20actor' },
        ],
        automationEvidence: [
            'Rotating background enrichment inferred government, defense, policy, and media targeting from the baseline actor summary.',
            'Technique inference mapped phishing, credential access, and malware/tool transfer where source language supports it.',
        ],
        plannedWork: [
            'Refresh stable actor metadata through the always-on cache warmer.',
            'Attach campaign-level technique sources when reporting names tools, CVEs, or infrastructure.',
        ],
    },
    {
        id: 'lazarus',
        name: 'Lazarus Group',
        aliases: ['Hidden Cobra', 'Diamond Sleet'],
        status: 'ready',
        confidence: 0.68,
        lastUpdatedAt: '2026-06-27T17:52:00.000Z',
        nextRefreshAt: '2026-06-27T18:52:00.000Z',
        changedFields: ['targets', 'ttps', 'sources'],
        sourceLinks: [
            { name: 'Google Cloud APT groups', url: 'https://cloud.google.com/security/resources/insights/apt-groups' },
            { name: 'Live reporting query', url: 'https://news.google.com/search?q=Lazarus%20Group%20threat%20actor' },
        ],
        automationEvidence: [
            'Shared enrichment inferred supply-chain, cryptocurrency, espionage, and data-theft context from catalog language.',
            'Actor cache built without a per-actor hand-written profile override.',
        ],
        plannedWork: [
            'Track recent cryptocurrency, supply-chain, and malware reporting separately from stable identity metadata.',
            'Promote customer-domain matches to exposure alerts when monitored source records name a company.',
        ],
    },
    {
        id: 'volt-typhoon',
        name: 'Volt Typhoon',
        aliases: ['Vanguard Panda', 'Bronze Silhouette'],
        status: 'ready',
        confidence: 0.68,
        lastUpdatedAt: '2026-06-27T17:51:00.000Z',
        nextRefreshAt: '2026-06-27T18:51:00.000Z',
        changedFields: ['targets', 'ttps', 'datasets'],
        sourceLinks: [
            { name: 'Google Cloud APT groups', url: 'https://cloud.google.com/security/resources/insights/apt-groups' },
            { name: 'Live reporting query', url: 'https://news.google.com/search?q=Volt%20Typhoon%20threat%20actor' },
        ],
        automationEvidence: [
            'Shared enrichment inferred critical-infrastructure and living-off-the-land monitoring priorities from actor summary language.',
        ],
        plannedWork: [
            'Separate critical-infrastructure context from company exposure alerts.',
            'Track new reporting for edge-device and credential-access changes.',
        ],
    },
]

const queuedActors: TiEnrichedActor[] = [
    {
        id: 'salt-typhoon',
        name: 'Salt Typhoon',
        aliases: [],
        status: 'queued',
        confidence: 0.42,
        lastUpdatedAt: '2026-06-27T15:38:00.000Z',
        nextRefreshAt: '2026-06-27T18:12:00.000Z',
        changedFields: [],
        sourceLinks: [
            { name: 'Google Cloud APT groups', url: 'https://cloud.google.com/security/resources/insights/apt-groups' },
            { name: 'Live reporting query', url: 'https://news.google.com/search?q=Salt%20Typhoon%20threat%20actor' },
        ],
        automationEvidence: ['Queued by the rotating actor freshness sweep because telecommunications reporting is time-sensitive.'],
        plannedWork: [
            'Refresh telecom and network-provider reporting.',
            'Extract affected infrastructure classes and campaign names.',
            'Compare against watched customer/vendor domains.',
        ],
    },
    {
        id: 'scattered-spider',
        name: 'Scattered Spider',
        aliases: ['UNC3944', 'Octo Tempest', '0ktapus'],
        status: 'queued',
        confidence: 0.44,
        lastUpdatedAt: '2026-06-27T15:35:00.000Z',
        nextRefreshAt: '2026-06-27T18:18:00.000Z',
        changedFields: [],
        sourceLinks: [
            { name: 'Live reporting query', url: 'https://news.google.com/search?q=Scattered%20Spider%20threat%20actor' },
        ],
        automationEvidence: ['Queued because social-engineering and help-desk abuse reporting changes quickly and should not depend on stale profile text.'],
        plannedWork: [
            'Refresh identity/social-engineering tactics.',
            'Extract SaaS, help-desk, SIM-swap, and cloud-control-plane references.',
            'Re-score buyer relevance for enterprise monitoring copy.',
        ],
    },
]

const activity: TiActivityEvent[] = [
    {
        id: 'act-apt49-live',
        actorId: 'apt49',
        actorName: 'APT49',
        happenedAt: '2026-06-27T17:55:00.000Z',
        title: 'APT49 returned enriched profile plus recent activity',
        detail: 'Production API returned aliases, recent activity, 3 targets, 4 TTPs, curated sources, and live reporting links.',
        source: 'api/ti/search automatic enrichment',
        tone: 'ok',
    },
    {
        id: 'act-apt28-auto',
        actorId: 'apt28',
        actorName: 'APT28',
        happenedAt: '2026-06-27T17:53:00.000Z',
        title: 'Generic enrichment built APT28 profile',
        detail: 'Baseline actor summary produced source links, target sectors, inferred TTPs, datasets, and cacheable profile fields without a custom APT28 override.',
        source: 'baseline actor enrichment builder',
        tone: 'ok',
    },
    {
        id: 'act-lazarus-auto',
        actorId: 'lazarus',
        actorName: 'Lazarus Group',
        happenedAt: '2026-06-27T17:52:00.000Z',
        title: 'Generic enrichment built Lazarus Group profile',
        detail: 'Supply-chain, cryptocurrency, espionage, and data-theft language was converted into profile metadata and monitoring tasks.',
        source: 'baseline actor enrichment builder',
        tone: 'ok',
    },
    {
        id: 'act-queue',
        actorId: 'salt-typhoon',
        actorName: 'Salt Typhoon',
        happenedAt: '2026-06-27T17:49:00.000Z',
        title: 'Salt Typhoon queued for next refresh',
        detail: 'The scheduler selected this actor because telecom/network-provider reporting is high-value and freshness-sensitive.',
        source: 'rotating actor freshness sweep',
        tone: 'watch',
    },
]

const auditLog: TiManagementAuditEvent[] = [
    {
        id: 'audit-enrich-apt49',
        happenedAt: '2026-06-27T17:55:00.000Z',
        actor: 'ti-profile-refresh',
        action: 'profile.enrich',
        target: 'actor:apt49',
        result: 'updated',
        detail: 'Merged source links, alias collision notes, live reporting rows, inferred TTPs, datasets, and cache metadata.',
    },
    {
        id: 'audit-cache-apt49',
        happenedAt: '2026-06-27T17:55:01.000Z',
        actor: 'ti-api-cache',
        action: 'profile.cache.write',
        target: 'actor:apt49',
        result: 'stored',
        detail: 'Stored stable profile fields with long TTL while recent activity keeps short refresh behavior.',
    },
    {
        id: 'audit-enrich-apt28',
        happenedAt: '2026-06-27T17:53:00.000Z',
        actor: 'ti-profile-refresh',
        action: 'profile.enrich',
        target: 'actor:apt28',
        result: 'updated',
        detail: 'Generated profile from shared baseline actor enrichment builder.',
    },
    {
        id: 'audit-queue-salt',
        happenedAt: '2026-06-27T17:49:00.000Z',
        actor: 'ti-scheduler',
        action: 'profile.queue',
        target: 'actor:salt-typhoon',
        result: 'queued',
        detail: 'Queued for rotating background refresh based on source freshness and customer relevance.',
    },
    {
        id: 'audit-admin-view',
        happenedAt: '2026-06-27T17:48:00.000Z',
        actor: 'admin-console',
        action: 'management.view',
        target: 'dashboard:ti',
        result: 'recorded',
        detail: 'Admin management activity is retained so source/run/profile changes can be reviewed.',
    },
]

export function getTiEnrichmentOverview() {
    return {
        updatedActors,
        queuedActors,
        activity,
        auditLog,
        stats: {
            updatedLastHour: updatedActors.length,
            queued: queuedActors.length,
            auditedEvents: auditLog.length,
            automaticCoverage: updatedActors.length + queuedActors.length,
        },
    }
}

export function getTiActorById(id: string) {
    return [...updatedActors, ...queuedActors].find(actor => actor.id === id) || null
}
