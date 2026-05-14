const fallbackCreated = '2024-01-01T00:00:00.000Z'

const fallbackArticles: Article[] = [
    {
        id: 'bot',
        size: 1379,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'How to create a scalable Discord bot for your community',
        content: [
            '# How to create a scalable Discord bot for your community',
            '',
            'Start with the smallest workflow the server actually needs. A useful bot usually begins as one dependable command, one permission model, and one background job rather than a large command catalogue.',
            '',
            'Keep configuration outside the code, store secrets in the deployment environment, and log moderation actions in a channel that trusted admins can audit. For larger servers, split event handling from slow work so message events stay responsive while jobs such as role sync, wiki updates, or game-server mirrors run in a queue.',
            '',
            'The final check is operational: the bot should restart cleanly, explain failed commands to users, and give maintainers enough logs to diagnose permission or API-limit problems without reading the source.'
        ].join('\n'),
        metadata: {
            image: '/images/assets/city.jpg',
            description: 'Custom Discord bot work for role management, game server mirrors, wiki pages, infrastructure automation, and self-updating deployments.',
            wordCount: 117,
            estimatedMinutes: 1,
        },
    },
    {
        id: 'cache',
        size: 1258,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'How to set up performant low latency caching?',
        content: [
            '# How to set up performant low latency caching',
            '',
            'Cache the response that hurts users, not every response by default. A good first pass is to identify the route with repeated reads, define how stale the answer is allowed to be, and make invalidation explicit.',
            '',
            'For Next.js and API services, keep the fast path boring: normalize cache keys, include the current user or tenant when data is private, and set short TTLs until the data model is stable. Add longer-lived edge or Redis caches only after the route has clear ownership and observability.',
            '',
            'Production caching should be easy to turn off. Ship metrics for hit rate, latency, and stale responses so the cache can be treated as infrastructure rather than mystery state.'
        ].join('\n'),
        metadata: {
            image: '/images/assets/art.png',
            description: 'A small Next.js-oriented cache setup for low-latency responses without heavy abstractions.',
            wordCount: 111,
            estimatedMinutes: 1,
        },
    },
    {
        id: 'event',
        size: 1224,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'How to create an event management React Native application',
        content: [
            '# How to create an event management React Native application',
            '',
            'The useful version of an event app is not a calendar clone. It is a workflow for creating an event, inviting the right people, updating the schedule, and handling the awkward cases: cancellations, late changes, check-in, and reminders.',
            '',
            'Build the first version around offline-tolerant reads and careful notification settings. People open event apps while moving, so screens should be fast, forms should save drafts, and the most important details should fit on a phone without digging.',
            '',
            'For teams, add roles early. Organizers need editing rights, attendees need clear status, and admins need an audit trail when details change.'
        ].join('\n'),
        metadata: {
            image: '/images/assets/project.jpg',
            description: 'React Native event management work for schedules, notifications, and organization activity flows.',
            wordCount: 103,
            estimatedMinutes: 1,
        },
    },
    {
        id: 'lsm',
        size: 462,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'Library Safety Manager',
        content: '# Library Safety Manager\n\nLibrary Safety Manager is an open source plugin for Artifactory that helps allow and block packages to reduce malicious or vulnerable dependency downloads.',
        metadata: {
            image: '/images/assets/abstract.jpg',
            description: 'An Artifactory extension for proactively blocking vulnerable or malicious package downloads.',
            wordCount: 27,
            estimatedMinutes: 1,
        },
    },
    {
        id: 'readme',
        size: 1560,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'Hey, I’m Eirik Hanasand',
        content: '# Hey, I’m Eirik Hanasand\n\nPersonal readme and context for the older Hanasand portfolio, projects, security work, and developer tooling experiments.',
        metadata: {
            image: '',
            description: 'Personal readme and context for Eirik Hanasand, older projects, and the personal side of the site.',
            wordCount: 22,
            estimatedMinutes: 1,
        },
    },
    {
        id: 'theme',
        size: 1156,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'How to create server-side themes for Next.js',
        content: [
            '# How to create server-side themes for Next.js',
            '',
            'Theme selection should be resolved before the page paints. Store the user preference in a cookie, read it on the server, and render the initial HTML with the correct class or data attribute so the interface does not flash through the wrong theme.',
            '',
            'Keep the theme tokens small and semantic: background, surface, foreground, muted text, accent, border, and danger are enough for most products. Components should consume those tokens instead of hard-coded color families, which keeps light, dark, and system themes aligned.',
            '',
            'The browser can still update the theme instantly after a user changes it, but the server value is the source of truth for the next navigation.'
        ].join('\n'),
        metadata: {
            image: '/images/assets/abstract.jpg',
            description: 'Notes on setting up server-side themes for Next.js without flash-of-default-theme problems.',
            wordCount: 113,
            estimatedMinutes: 1,
        },
    },
]

export default fallbackArticles

export function findFallbackArticle(id: string) {
    const normalized = id.replace(/\.md$/, '')
    return fallbackArticles.find((article) => article.id === normalized) || null
}

export function replaceDraftArticle(article: Article): Article {
    const fallback = findFallbackArticle(article.id)
    if (!fallback) {
        return article
    }

    const content = article.content || ''
    const wordCount = Number(article.metadata?.wordCount) || 0
    const fallbackWordCount = Number(fallback.metadata?.wordCount) || 0
    const looksUnfinished = /coming soon|TODO|placeholder/i.test(content)
        || (wordCount > 0 && wordCount <= 20 && fallbackWordCount > wordCount)

    return looksUnfinished ? fallback : article
}
