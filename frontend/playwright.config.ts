import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const manageServers = process.env.PLAYWRIGHT_MANAGED_SERVERS !== '0'
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE || 'http://127.0.0.1:8080/api'
const appPort = new URL(baseUrl).port || (new URL(baseUrl).protocol === 'https:' ? '443' : '80')
const apiPort = new URL(apiBaseUrl).port || (new URL(apiBaseUrl).protocol === 'https:' ? '443' : '80')
const sharedEnv = {
    ...process.env,
    DB_HOST: process.env.PLAYWRIGHT_DB_HOST || '127.0.0.1',
    DB_PORT: process.env.PLAYWRIGHT_DB_PORT || '8503',
    SKIP_MAIL_PROVISIONING: '1',
    SKIP_REPOSITORY_SYNC: '1',
    VULNERABILITY_SCAN_STATE_PATH: process.env.VULNERABILITY_SCAN_STATE_PATH || '/tmp/hanasand-vulnerability-scan-playwright.json',
    NEXT_PUBLIC_API: apiBaseUrl,
    FRONTEND_INTERNAL_API: apiBaseUrl,
    MAIL_JMAP_INTERNAL_URL: process.env.MAIL_JMAP_INTERNAL_URL || 'http://127.0.0.1:8081',
    MAIL_PUBLIC_BASE_URL: process.env.MAIL_PUBLIC_BASE_URL || 'http://127.0.0.1:8081',
}

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    expect: { timeout: 8_000 },
    fullyParallel: true,
    use: {
        baseURL: baseUrl,
        trace: 'on-first-retry',
    },
    webServer: manageServers ? [
        {
            command: 'bun run start:local',
            cwd: path.resolve(__dirname, '../api'),
            url: apiBaseUrl,
            reuseExistingServer: true,
            timeout: 120_000,
            env: {
                ...sharedEnv,
                PORT: apiPort,
            },
        },
        {
            command: 'bun run dev',
            cwd: __dirname,
            url: baseUrl,
            reuseExistingServer: true,
            timeout: 120_000,
            env: {
                ...sharedEnv,
                PORT: appPort,
            },
        },
    ] : undefined,
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
