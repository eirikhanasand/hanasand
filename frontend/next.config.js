const nextConfig = {
    allowedDevOrigins: ['127.0.0.1'],
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
