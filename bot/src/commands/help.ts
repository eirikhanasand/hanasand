import { MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { BotCommand } from './types.js'

const command: BotCommand = {
    data: new SlashCommandBuilder().setName('help').setDescription('Show the available bot commands.'),
    async execute(interaction) {
        await interaction.reply({
            content: '`/info` — Hanasand bot details\n`/ping` — bot and support connection status\n`/help` — this list',
            flags: MessageFlags.Ephemeral,
        })
    },
}

export default command
