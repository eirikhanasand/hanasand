import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'

export type CommandContext = { supportStreamConnected: boolean }

export type BotCommand = {
    data: SlashCommandBuilder
    execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>
}
