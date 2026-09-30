import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js'
import type { BotCommand } from './types.js'

const command: BotCommand = {
    data: new SlashCommandBuilder().setName('info').setDescription('Learn about the Hanasand bot.'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Hanasand')
            .setDescription('Hanasand website support and server information.')
            .addFields(
                { name: 'Website', value: '[hanasand.com](https://hanasand.com)', inline: true },
                { name: 'Support', value: 'Website support chats appear in private channels here.', inline: true },
            )
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
    },
}

export default command
