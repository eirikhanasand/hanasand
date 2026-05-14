import type { Viewport, Metadata } from 'next'

const title = 'Hanasand'
const description = 'A focused workspace for projects, service status, uploads, short links, and account access.'
const image = 'https://hanasand.com/favicon.ico'

const metadata: Metadata = {
    title,
    keywords: ['hanasand', 'operations workspace', 'service status', 'uploads', 'short links', 'projects', 'personal archive'],
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
        icon: '/favicon.ico',
        apple: '/apple-touch-icon.png',
    },
}

export default metadata

export const viewport: Viewport = {
    colorScheme: 'dark',
    themeColor: '#f07d33',
}
