import { createServer } from 'node:http'
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js'
import { commandsByName } from './commands/index.js'
import { loadConfig } from './config.js'
import { SupportBridge } from './support/bridge.js'

const config = loadConfig()
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })
const bridge = await SupportBridge.create(client, config)
let stopping: Promise<void> | undefined

const healthServer = createServer((_request, response) => {
    const ready = client.isReady() && bridge.isConnected
    response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    response.end(JSON.stringify({ ok: ready, discord: client.isReady(), supportStream: bridge.isConnected }))
})
healthServer.listen(config.port, '127.0.0.1')

client.once(Events.ClientReady, readyClient => {
    console.log(`Hanasand bot connected as ${readyClient.user.tag}.`)
    bridge.start()
})

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return
    if (interaction.guildId !== config.guildId) {
        await interaction.reply({ content: 'This command is configured for the Hanasand server.', flags: MessageFlags.Ephemeral })
        return
    }
    const command = commandsByName.get(interaction.commandName)
    if (!command) {
        await interaction.reply({ content: 'That command is not available.', flags: MessageFlags.Ephemeral })
        return
    }
    try {
        await command.execute(interaction, { supportStreamConnected: bridge.isConnected })
    } catch (error) {
        console.error(`Command /${interaction.commandName} failed:`, error instanceof Error ? error.message : 'unknown error')
        const response = { content: 'The command could not be completed. Please try again.', flags: MessageFlags.Ephemeral as const }
        if (interaction.replied || interaction.deferred) await interaction.followUp(response).catch(() => {})
        else await interaction.reply(response).catch(() => {})
    }
})

client.on(Events.Error, error => console.error('Discord client error:', error.message))
client.on(Events.ShardError, error => console.error('Discord gateway connection error:', error.message))

await client.login(config.token)

async function shutdown() {
    if (stopping) return stopping
    stopping = (async () => {
        await bridge.stop()
        client.destroy()
        await new Promise<void>((resolve, reject) => healthServer.close(error => error ? reject(error) : resolve()))
    })()
    return stopping
}

process.once('SIGINT', () => { void shutdown() })
process.once('SIGTERM', () => { void shutdown() })
