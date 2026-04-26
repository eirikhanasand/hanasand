import type { Metadata } from 'next'

const SITE_NAME = 'Hanasand'
const SITE_URL = 'https://hanasand.com'
const DEFAULT_IMAGE = `${SITE_URL}/favicon.ico`

type RouteMetadataArgs = {
    title: string
    description: string
    path: string
    keywords?: string[]
}

export function buildRouteMetadata({
    title,
    description,
    path,
    keywords = [],
}: RouteMetadataArgs): Metadata {
    const canonical = path === '/' ? SITE_URL : `${SITE_URL}${path}`
    const fullTitle = title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`

    return {
        title: fullTitle,
        description,
        keywords,
        alternates: {
            canonical: path,
        },
        openGraph: {
            title: fullTitle,
            description,
            url: canonical,
            siteName: SITE_NAME,
            images: [
                {
                    url: DEFAULT_IMAGE,
                    width: 600,
                    height: 600,
                    alt: `${SITE_NAME} Logo`,
                },
            ],
            locale: 'en_US',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: [DEFAULT_IMAGE],
        },
    }
}

export function humanizeSlug(slug: string) {
    return slug
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())
}
