import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

const requiredEnvironmentVariables = [
    'DB_PASSWORD',
    'DB_HOST',
    'VM_API_TOKEN',
]

const missingVariables = requiredEnvironmentVariables.filter(
    (key) => !process.env[key]
)

if (missingVariables.length > 0) {
    throw new Error(
        'Missing essential environment variables:\n' +
        missingVariables
            .map((key) => `${key}: ${process.env[key] || 'undefined'}`)
            .join('\n')
    )
}

const config = {
    API: process.env.NEXT_PUBLIC_API,
    DB: process.env.DB,
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_PORT: process.env.DB_PORT,
    DB_MAX_CONN: process.env.DB_MAX_CONN,
    DB_IDLE_TIMEOUT_MS: process.env.DB_IDLE_TIMEOUT_MS,
    DB_TIMEOUT_MS: process.env.DB_TIMEOUT_MS,
    DEFAULT_RESULTS_PER_PAGE: process.env.DEFAULT_RESULTS_PER_PAGE || 50,
    CACHE_TTL_HOT: 5000,
    CACHE_TTL_COLD: 300000,
    vm_api_token: process.env.VM_API_TOKEN,
    pwned: 'http://pwned:8080/api/pwned',
    pwned_ws: 'ws://pwned:8080/api/pwned/ws',
    // pwned_ws: 'ws://localhost:8201/api/pwned/ws',
    github_articles_ssh: 'git@github.com:eirikhanasand/hanasand.git',
    self_url: 'https://api.hanasand.com/api/auth/token',
    internal_api: process.env.INTERNAL_API || 'https://internal.hanasand.com/api',
}

export default config
