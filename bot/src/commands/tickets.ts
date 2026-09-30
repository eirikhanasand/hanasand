import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import type { BotCommand } from './types.js'

const supportPage = 'https://hanasand.com/support'

const command: BotCommand = {
    data: new SlashCommandBuilder().setName('tickets').setDescription('Post the Hanasand support ticket panel.'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Hanasand Support')
            .setDescription('Open a support chat for Hanasand account, product, or billing questions. Chats that need our team appear in private channels under **support** and sync live with the website.')
            .addFields(
                { name: 'Create', value: 'Start a new support chat on Hanasand.' },
                { name: 'View', value: 'See your existing support chats.' },
                { name: 'Close', value: 'Resolve a chat when your question is answered.' },
                { name: 'Reopen', value: 'Continue a resolved conversation.' },
            )
            .setFooter({ text: 'Hanasand Support · hanasand.com' })
            .setTimestamp()

        const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setLabel('Create Ticket').setStyle(ButtonStyle.Link).setURL(supportPage),
            new ButtonBuilder().setLabel('View Tickets').setStyle(ButtonStyle.Link).setURL(supportPage),
            new ButtonBuilder().setLabel('Close Ticket').setStyle(ButtonStyle.Link).setURL(supportPage),
            new ButtonBuilder().setLabel('Reopen Ticket').setStyle(ButtonStyle.Link).setURL(supportPage),
        )

        await interaction.reply({ embeds: [embed], components: [actions], allowedMentions: { parse: [] } })
    },
}

export default command
