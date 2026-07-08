import type { MetadataRoute } from 'next'
import { articleRoutes, publicRoutes } from '@/utils/routes/publicRoutes'

const SITE_URL = 'https://hanasand.com'

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        ...publicRoutes.map((route) => ({
            url: route === '/' ? SITE_URL : `${SITE_URL}${route}`,
            changeFrequency: route === '/' ? 'weekly' as const : 'monthly' as const,
            priority: route === '/' ? 1 : route.startsWith('/eirik') ? 0.5 : 0.6,
        })),
        ...articleRoutes.map((route) => ({
            url: `${SITE_URL}${route}`,
            changeFrequency: 'monthly' as const,
            priority: 0.45,
        })),
    ]
}
