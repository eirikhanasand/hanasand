import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: '../../.env' })

const currentFile = fileURLToPath(import.meta.url)
const srcDir = path.dirname(currentFile)
const apiDir = path.resolve(srcDir, '..')
const gptDir = path.resolve(apiDir, '..')
const repoRoot = path.resolve(gptDir, '..')
const modulesDir = path.resolve(gptDir, 'modules')

const requiredEnvironmentVariables = [
    'API',
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
    ws_api: env.API,
    model_api: process.env.MODEL_API || 'http://127.0.0.1:8081',
    gpt_dir: gptDir,
    repo_root: repoRoot,
    modules_dir: modulesDir,
    web_search_enabled: process.env.HANASAND_WEB_SEARCH !== '0',
    web_search_max_iterations: Number(process.env.HANASAND_WEB_SEARCH_MAX_ITERATIONS || 2),
    reasoning_budget: Number(process.env.HANASAND_REASONING_BUDGET || -1),
    command_timeout_ms: Number(process.env.HANASAND_COMMAND_TIMEOUT_MS || 120000),
}

export default config
