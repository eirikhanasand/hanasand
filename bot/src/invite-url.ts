import { PermissionFlagsBits, PermissionsBitField } from 'discord.js'

const clientId = process.env.DISCORD_CLIENT_ID?.trim()
const guildId = process.env.DISCORD_GUILD_ID?.trim()
if (!clientId || !/^\d{17,20}$/.test(clientId)) throw new Error('Set a valid DISCORD_CLIENT_ID.')
if (!guildId || !/^\d{17,20}$/.test(guildId)) throw new Error('Set a valid DISCORD_GUILD_ID.')

const permissions = PermissionsBitField.resolve([
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
])
const invite = new URL('https://discord.com/oauth2/authorize')
invite.searchParams.set('client_id', clientId)
invite.searchParams.set('scope', 'bot applications.commands')
invite.searchParams.set('permissions', permissions.toString())
invite.searchParams.set('guild_id', guildId)
invite.searchParams.set('disable_guild_select', 'true')
console.log(invite.toString())
