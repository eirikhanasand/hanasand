import type { Viewport, Metadata } from 'next'

const title = 'Hanasand'
const description = 'Dark web monitoring, company exposure alerts, and threat intelligence workflows from Hanasand.'
const image = 'https://hanasand.com/favicon.svg'

const metadata: Metadata = {
    title,
    keywords: ['hanasand', 'dark web monitoring', 'threat intelligence', 'company exposure alerts', 'ransomware monitoring', 'webhook alerts'],
    authors: [{ name: 'Eirik Hanasand', url: 'https://hanasand.com' }],
    description,
    creator: 'Eirik Hanasand',
    publisher: 'Eirik Hanasand',
    metadataBase: new URL('https://hanasand.com'),
    alternates: {
        canonical: '/',
    },
    openGraph: {
        title,
        description,
        url: 'https://hanasand.com',
        siteName: 'Hanasand',
        images: [
            {
                url: image,
                width: 600,
                height: 600,
                alt: 'Hanasand Logo',
            },
        ],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-snippet': -1,
            'max-image-preview': 'large',
            'max-video-preview': -1,
        },
    },
    icons: {
        icon: [
            { url: '/favicon-light.svg', media: '(prefers-color-scheme: light)', type: 'image/svg+xml' },
            { url: '/favicon.svg', media: '(prefers-color-scheme: dark)', type: 'image/svg+xml' },
            { url: '/favicon.ico' },
        ],
        apple: '/apple-touch-icon.png',
    },
}

export default metadata

export const viewport: Viewport = {
    colorScheme: 'light dark',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: 'rgb(255 255 255)' },
        { media: '(prefers-color-scheme: dark)', color: 'rgb(14 21 32)' },
    ],
}
