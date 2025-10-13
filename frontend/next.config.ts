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
        ]
    },
    /* config options here */
}
   
module.exports = nextConfig
