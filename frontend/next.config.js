const appRoutes = require('./src/utils/routes/appRoutes.json')

const nextConfig = {
    distDir: process.env.NEXT_DIST_DIR || '.next',
    allowedDevOrigins: ['127.0.0.1'],
    experimental: {
        cpus: 2,
    },
    output: 'standalone',
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), geolocation=(), microphone=()',
                    },
                ],
            },
        ]
    },
    // The canonical Findings route maps to the dashboard/findings page folder via appRoutes.json.
    async rewrites() {
        return {
            beforeFiles: [
                { source: '/api/dwm', destination: '/api/findings' },
                { source: '/api/dwm/:path*', destination: '/api/findings/:path*' },
                ...appRoutes
                    .filter(([, canonical]) => canonical !== '/dashboard')
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([legacy, canonical]) => ({ source: `${canonical}/:path*`, destination: `${legacy}/:path*` })),
            ],
        }
    },
    async redirects() {
        return [
            { source: '/findings/watchlists', destination: '/watchlists', permanent: true },
            { source: '/ti/enrichment', destination: '/ti/profiles', permanent: true },
            { source: '/ti/domains/:path*', destination: '/ti/sources', permanent: true },
            { source: '/dashboard/ti/domains/:path*', destination: '/ti/sources', permanent: true },
            { source: '/cases/MON-:number', destination: '/cases/HA-:number', permanent: true },
            { source: '/dashboard/cases/MON-:number', destination: '/cases/HA-:number', permanent: true },
            { source: '/dwm/cases/:path*', destination: '/cases/:path*', permanent: true },
            { source: '/dwm', destination: '/findings', permanent: true },
            { source: '/dwm/:path*', destination: '/findings/:path*', permanent: true },
            { source: '/dashboard/dwm/cases/:path*', destination: '/cases/:path*', permanent: true },
            { source: '/dashboard/dwm', destination: '/findings', permanent: true },
            { source: '/dashboard/dwm/:path*', destination: '/findings/:path*', permanent: true },
            {
                source: '/solutions/dwm',
                destination: '/findings',
                permanent: true,
            },
            {
                source: '/solutions/onion-session',
                destination: '/browser',
                permanent: true,
            },
        ]
    },
    turbopack: {
        root: __dirname,
    },
    images: {
        qualities: [75, 100],
        localPatterns: [
            { pathname: '/**', search: '' },
            { pathname: '/hanasand-logo.png', search: '?v=transparent-1' },
        ],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.hanasand.com',
                port: '',
                pathname: '/**',
                search: '',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '8501',
                pathname: '/**',
                search: '',
            },
        ]
    }
}

module.exports = nextConfig
