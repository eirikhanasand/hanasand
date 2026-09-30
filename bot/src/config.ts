const snowflakePattern = /^\d{17,20}$/

export type BotConfig = {
    token: string
    clientId: string
    guildId: string
    supportApiKey: string
    apiBase: URL
    supportRoleId?: string
    supportCategoryId?: string
    stateFile: string
    port: number
}

function required(env: NodeJS.ProcessEnv, key: string) {
    const value = env[key]?.trim()
    if (!value) throw new Error(`Missing required environment variable: ${key}`)
    return value
}

function optionalSnowflake(env: NodeJS.ProcessEnv, key: string) {
    const value = env[key]?.trim()
    if (!value) return undefined
    if (!snowflakePattern.test(value)) throw new Error(`${key} must be a Discord ID.`)
    return value
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
    const token = required(env, 'DISCORD_BOT_TOKEN')
    const clientId = required(env, 'DISCORD_CLIENT_ID')
    const guildId = required(env, 'DISCORD_GUILD_ID')
    const supportApiKey = required(env, 'HANASAND_DISCORD_SUPPORT_API_KEY')
    if (!snowflakePattern.test(clientId)) throw new Error('DISCORD_CLIENT_ID must be a Discord ID.')
    if (!snowflakePattern.test(guildId)) throw new Error('DISCORD_GUILD_ID must be a Discord ID.')
    if (!/^hsk_[a-f0-9]{12}_[a-f0-9]{48}$/.test(supportApiKey)) throw new Error('HANASAND_DISCORD_SUPPORT_API_KEY is not a Hanasand API key.')

    const apiBase = new URL(env.HANASAND_API_BASE?.trim() || 'https://api.hanasand.com')
    if (!['https:', 'http:'].includes(apiBase.protocol)) throw new Error('HANASAND_API_BASE must use HTTP or HTTPS.')
    if (apiBase.protocol === 'http:' && !['localhost', '127.0.0.1', 'api'].includes(apiBase.hostname)) {
        throw new Error('Use HTTPS for a remote HANASAND_API_BASE.')
    }
    apiBase.pathname = apiBase.pathname.replace(/\/$/, '')
    apiBase.search = ''
    apiBase.hash = ''

    const port = Number(env.PORT || 3000)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.')
    const supportRoleId = optionalSnowflake(env, 'DISCORD_SUPPORT_ROLE_ID')
    const supportCategoryId = optionalSnowflake(env, 'DISCORD_SUPPORT_CATEGORY_ID')
    return {
        token,
        clientId,
        guildId,
        supportApiKey,
        apiBase,
        ...(supportRoleId ? { supportRoleId } : {}),
        ...(supportCategoryId ? { supportCategoryId } : {}),
        stateFile: env.SUPPORT_STATE_FILE?.trim() || './data/support-state.json',
        port,
    }
}
