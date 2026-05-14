import type { MetadataRoute } from 'next'

const SITE_URL = 'https://hanasand.com'

const publicRoutes = [
    '/',
    '/about',
    '/articles',
    '/contact',
    '/eirik',
    '/eirik/motivation',
    '/gallery',
    '/g',
    '/g/stats',
    '/pwned',
    '/reserved-usernames',
    '/status',
    '/upload',
]

export default function sitemap(): MetadataRoute.Sitemap {
    return publicRoutes.map((route) => ({
        url: route === '/' ? SITE_URL : `${SITE_URL}${route}`,
        changeFrequency: route === '/' ? 'weekly' : 'monthly',
        priority: route === '/' ? 1 : route.startsWith('/eirik') ? 0.5 : 0.6,
    }))
}
