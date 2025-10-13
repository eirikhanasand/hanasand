const nextConfig = {
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
    },
    /* config options here */
}

module.exports = nextConfig
