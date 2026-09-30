import { MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { BotCommand } from './types.js'

const command: BotCommand = {
    data: new SlashCommandBuilder().setName('ping').setDescription('Check that the bot and support connection are online.'),
    async execute(interaction, context) {
        const roundTripMs = Math.max(0, Date.now() - interaction.createdTimestamp)
        const support = context.supportStreamConnected ? 'connected' : 'reconnecting'
        await interaction.reply({
            content: `Pong! Discord round trip: ${roundTripMs} ms. Website support: ${support}.`,
            flags: MessageFlags.Ephemeral,
        })
    },
}

export default command
