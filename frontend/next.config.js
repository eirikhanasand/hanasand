const nextConfig = {
    allowedDevOrigins: ['127.0.0.1'],
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
    turbopack: {
        root: __dirname,
    },
    images: {
        qualities: [75, 100],
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
