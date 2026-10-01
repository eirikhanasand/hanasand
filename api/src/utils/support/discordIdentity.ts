export type DiscordSupportIdentity = {
    displayName: string
    isSupportMember: boolean
}

export class DiscordIdentityError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'DiscordIdentityError'
    }
}

export function parseDiscordSupportIdentity(value: unknown, supportRoleId: string): DiscordSupportIdentity | null {
    if (!value || typeof value !== 'object') return null
    const member = value as {
        nick?: unknown
        roles?: unknown
        user?: { global_name?: unknown; username?: unknown }
    }
    if (!Array.isArray(member.roles) || !member.user || typeof member.user !== 'object') return null
    const clean = (name: unknown) => typeof name === 'string'
        ? name.replace(/[\r\n\0]/g, ' ').trim().slice(0, 80)
        : ''
    const displayName = clean(member.nick) || clean(member.user.global_name) || clean(member.user.username)
    if (!displayName) return null
    return {
        displayName,
        isSupportMember: member.roles.includes(supportRoleId),
    }
}

export async function getDiscordSupportIdentity(discordUserId: string): Promise<DiscordSupportIdentity | null> {
    const token = process.env.DISCORD_BOT_TOKEN?.trim()
    const guildId = process.env.DISCORD_GUILD_ID?.trim()
    const roleId = process.env.DISCORD_SUPPORT_ROLE_ID?.trim()
    if (!token || !guildId || !roleId) throw new DiscordIdentityError('Discord support identity is not configured.')

    let response: Response
    try {
        response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`, {
            headers: { authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(5_000),
        })
    } catch {
        throw new DiscordIdentityError('Discord could not verify this server member.')
    }
    if (response.status === 404) return null
    if (!response.ok) throw new DiscordIdentityError(`Discord member verification returned HTTP ${response.status}.`)
    return parseDiscordSupportIdentity(await response.json().catch(() => null), roleId)
}
