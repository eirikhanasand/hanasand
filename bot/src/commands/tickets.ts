import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import type { BotCommand } from './types.js'

const command: BotCommand = {
    data: new SlashCommandBuilder().setName('tickets').setDescription('Post the Hanasand support ticket panel.'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Hanasand Support')
            .setDescription('Create and manage Hanasand support chats here in Discord. Messages sync live with your Hanasand support history.')
            .addFields(
                { name: 'Create ticket', value: 'Start a private support chat in Discord.' },
                { name: 'Ticket history', value: 'Open or restore previous support chats.' },
                { name: 'Link account (optional)', value: 'Connect Hanasand to see these tickets in your website history too.' },
            )
            .setFooter({ text: 'Resolved channels are removed after 24 hours; tickets remain in your history.' })
            .setTimestamp()

        const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('support-ticket:create').setLabel('Create ticket').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('support-ticket:history').setLabel('Ticket history').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('support-ticket:link').setLabel('Link account').setStyle(ButtonStyle.Secondary),
        )

        await interaction.reply({ embeds: [embed], components: [actions], allowedMentions: { parse: [] } })
    },
}

export default command
