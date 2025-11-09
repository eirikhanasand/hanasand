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

const env = Object.fromEntries(
    requiredEnvironmentVariables.map((key) => [key, process.env[key]])
)

const config = {
    API: env.NEXT_PUBLIC_API,
    DB: env.DB,
    DB_HOST: env.DB_HOST,
    DB_USER: env.DB_USER,
    DB_PASSWORD: env.DB_PASSWORD,
    DB_PORT: env.DB_PORT,
    DB_MAX_CONN: env.DB_MAX_CONN,
    DB_IDLE_TIMEOUT_MS: env.DB_IDLE_TIMEOUT_MS,
    DB_TIMEOUT_MS: env.DB_TIMEOUT_MS,
    DEFAULT_RESULTS_PER_PAGE: env.DEFAULT_RESULTS_PER_PAGE || 50,
    CACHE_TTL: 30000,
    vm_api_token: env.VM_API_TOKEN,
    pwned: 'http://pwned:8080/api/pwned',
    pwned_ws: 'ws://pwned:8080/api/pwned/ws/',
    // pwned_ws: 'ws://localhost:8201/api/pwned/ws/',
    github_articles_ssh: 'git@github.com:eirikhanasand/hanasand.git',
    self_url: 'https://api.hanasand.com/api/auth/token',
    internal_api: 'https://internal.hanasand.com/api',
}

export default config
