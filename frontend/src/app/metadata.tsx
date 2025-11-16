import type { Viewport, Metadata } from 'next'

const metadata: Metadata = {
    title: 'Hanasand',
    keywords: ['hanasand', 'portfolio', 'developer', 'pwned', 'editor', 'markdown', 'load test', 'cdn', 'upload', 'image', 'code'],
    authors: [{ name: 'Eirik Hanasand', url: 'https://hanasand.com' }],
    description: 'Welcome to Hanasand',
    themeColor: '#e25822',
    creator: 'Eirik Hanasand',
    publisher: 'Eirik Hanasand',
    openGraph: {
        title: 'Hanasand',
        description: 'Welcome to Hanasand',
        url: 'https://hanasand.com',
        siteName: 'Hanasand',
        images: [
            {
                url: 'https://hanasand.com/favicon.ico',
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
        title: 'Hanasand',
        description: 'Welcome to Hanasand',
        images: ['https://hanasand.com/favicon.ico'],
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
    themeColor: '#e25822',
}
