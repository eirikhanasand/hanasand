// Constants used throughout the API. Static ones are defined here, while
// dynamic ones are fetched from the environment variables.

import dotenv from 'dotenv'

type ENV = {
    DB: string
    DB_PASSWORD: string
    DB_USER: string
    DB_HOST: string
    DB_PORT: string
    DB_MAX_CONN: string
    DB_IDLE_TIMEOUT_MS: string
    DB_TIMEOUT_MS: string
    DEFAULT_RESULTS_PER_PAGE: string
    NEXT_PUBLIC_SELF_URL: string
    NEXT_PUBLIC_API: string
}

dotenv.config({ path: '../.env' })

const {
    DB,
    DB_USER,
    DB_HOST,
    DB_PASSWORD,
    DB_PORT,
    DB_MAX_CONN,
    DB_IDLE_TIMEOUT_MS,
    DB_TIMEOUT_MS,
    DEFAULT_RESULTS_PER_PAGE: ENV_DEFAULT_RESULTS_PER_PAGE,
    NEXT_PUBLIC_SELF_URL,
    NEXT_PUBLIC_API,
} = process.env as unknown as ENV
if (!NEXT_PUBLIC_API || !DB_PASSWORD) {
    throw new Error('Missing NEXT_PUBLIC_API or DB_PASSWORD.')
}

const config = {
    API: NEXT_PUBLIC_API,
    DB,
    DB_HOST,
    DB_USER,
    DB_PASSWORD,
    DB_PORT,
    DB_MAX_CONN,
    DB_IDLE_TIMEOUT_MS,
    DB_TIMEOUT_MS,
    DEFAULT_RESULTS_PER_PAGE: ENV_DEFAULT_RESULTS_PER_PAGE || 50,
    SELF_URL: NEXT_PUBLIC_SELF_URL,
    CACHE_TTL: 30000
}

export default config
