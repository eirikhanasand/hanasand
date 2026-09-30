import { REST, Routes } from 'discord.js'
import { commands } from './commands/index.js'

function required(name: string) {
    const value = process.env[name]?.trim()
    if (!value) throw new Error(`Set ${name} before deploying slash commands.`)
    return value
}

const token = required('DISCORD_BOT_TOKEN')
const clientId = required('DISCORD_CLIENT_ID')
const guildId = required('DISCORD_GUILD_ID')
const rest = new REST({ version: '10' }).setToken(token)
await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands.map(command => command.data.toJSON()),
})
console.log(`Registered ${commands.length} Hanasand commands in guild ${guildId}.`)
