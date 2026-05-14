import type { Viewport, Metadata } from 'next'

const title = 'Hanasand'
const description = 'Autonomous production assistant for building, verifying, deploying, and recovering websites with visible proof.'
const image = 'https://hanasand.com/favicon.ico'

const metadata: Metadata = {
    title,
    keywords: ['hanasand', 'ai coding', 'website builder', 'production assistant', 'deploy websites', 'verified builds', 'portfolio', 'developer tools'],
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
