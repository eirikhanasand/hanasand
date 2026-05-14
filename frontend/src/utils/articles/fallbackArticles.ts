const fallbackCreated = '2024-01-01T00:00:00.000Z'

const fallbackArticles: Article[] = [
    {
        id: 'bot',
        size: 444,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'How to create a scalable Discord bot specific to your needs?',
        content: '# How to create a scalable Discord bot specific to your needs?\n\nComing soon <3',
        metadata: {
            image: '/images/assets/city.jpg',
            description: 'Custom Discord bot work for role management, game server mirrors, wiki pages, infrastructure automation, and self-updating deployments.',
            wordCount: 14,
            estimatedMinutes: 1,
        },
    },
    {
        id: 'cache',
        size: 397,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'How to set up performant low latency caching?',
        content: '# How to set up performant low latency caching?\n\nComing soon <3',
        metadata: {
            image: '/images/assets/art.png',
            description: 'A small Next.js-oriented cache setup for low-latency responses without heavy abstractions.',
            wordCount: 13,
            estimatedMinutes: 1,
        },
    },
    {
        id: 'event',
        size: 426,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'How to create a event management React Native Application?',
        content: '# How to create a event management React Native Application?\n\nComing soon <3',
        metadata: {
            image: '/images/assets/project.jpg',
            description: 'React Native event management work for schedules, notifications, and organization activity flows.',
            wordCount: 13,
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
        size: 345,
        created: fallbackCreated,
        modified: fallbackCreated,
        title: 'How to create server side themes for NextJS?',
        content: '# How to create server side themes for NextJS?\n\nComing soon <3',
        metadata: {
            image: '/images/assets/abstract.jpg',
            description: 'Notes on setting up server-side themes for Next.js without flash-of-default-theme problems.',
            wordCount: 13,
            estimatedMinutes: 1,
        },
    },
]

export default fallbackArticles

export function findFallbackArticle(id: string) {
    const normalized = id.replace(/\.md$/, '')
    return fallbackArticles.find((article) => article.id === normalized) || null
}
