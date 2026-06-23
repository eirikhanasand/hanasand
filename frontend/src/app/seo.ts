import type { Metadata } from 'next'

const SITE_NAME = 'Hanasand'
const SITE_URL = 'https://hanasand.com'
const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`

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
    const clean = slug.trim()
    if (/^cve-\d{4}-\d{4,}$/i.test(clean)) return clean.toUpperCase()

    return clean
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(humanizeToken)
        .join(' ')
}

function humanizeToken(token: string) {
    if (/^(apt|cve|mitre|nvd|api|url|ip|dns|soc)\d*$/i.test(token)) return token.toUpperCase()
    const lower = token.toLowerCase()
    if (/^\d+$/.test(lower)) return lower
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}
