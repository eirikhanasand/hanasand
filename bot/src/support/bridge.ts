import { createHash } from 'node:crypto'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, Events, MessageFlags, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction, type Client, type Guild, type Message, type ModalSubmitInteraction, type OverwriteData, type Role, type StringSelectMenuInteraction, type TextChannel } from 'discord.js'
import WebSocket from 'ws'
import type { BotConfig } from '../config.js'
import { SupportApi, SupportApiError, type SupportMessage, type SupportTicket } from './api.js'
import { SupportState, type TicketState } from './state.js'

const ticketMarker = 'hanasand-support-ticket:'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const retentionMs = 24 * 60 * 60 * 1000

type ChangeEvent = { type?: unknown; id?: unknown }

function makeRequestId(discordMessageId: string) {
    const bytes = Buffer.from(createHash('sha256').update(`hanasand-discord:${discordMessageId}`).digest('hex').slice(0, 32), 'hex')
    bytes[6] = (bytes[6]! & 0x0f) | 0x50
    bytes[8] = (bytes[8]! & 0x3f) | 0x80
    const hex = bytes.toString('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}


function splitMessage(value: string, limit = 1800) {
    const characters = Array.from(value)
    const parts: string[] = []
    while (characters.length > limit) parts.push(characters.splice(0, limit).join(''))
    if (characters.length) parts.push(characters.join(''))
    return parts.length ? parts : [' ']
}

function ticketChannelName(number: number, value: string) {
    const title = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48).replace(/-$/g, '') || 'ticket'
    return `ha-${number}-${title}`
}

function supportAuthor(message: SupportMessage) {
    if (message.sender_kind === 'assistant') return 'Hanasand AI'
    if (message.sender_kind === 'system') return 'Support'
    return message.sender_name || (message.sender_kind === 'support' ? 'Support' : 'Visitor')
}

function channelIsText(channel: unknown): channel is TextChannel {
    return typeof channel === 'object' && channel !== null
        && 'type' in channel && (channel as TextChannel).type === ChannelType.GuildText
        && 'send' in channel && typeof (channel as TextChannel).send === 'function'
}

export class SupportBridge {
    private readonly api: SupportApi
    private socket?: WebSocket
    private guild?: Guild
    private supportCategoryId: string | undefined
    private supportRole: Role | undefined
    private connected = false
    private stopping = false
    private reconnectTimer: NodeJS.Timeout | undefined
    private retentionTimer: NodeJS.Timeout | undefined
    private reconnectAttempt = 0
    private readonly queueByTicket = new Map<string, Promise<void>>()
    private readonly ticketByChannel = new Map<string, string>()
    private readonly replayedTickets = new Set<string>()
    private readonly permissionWarnings = new Set<string>()

    private constructor(
        private readonly client: Client,
        private readonly config: BotConfig,
        private readonly state: SupportState,
    ) {
        this.api = new SupportApi(config.apiBase, config.supportApiKey)
        client.on(Events.MessageCreate, message => { void this.onMessage(message) })
    }

    static async create(client: Client, config: BotConfig) {
        return new SupportBridge(client, config, await SupportState.load(config.stateFile))
    }

    get isConnected() {
        return this.connected && this.socket?.readyState === WebSocket.OPEN
    }

    start() {
        this.stopping = false
        this.connect()
        this.scheduleRetentionCleanup()
    }

    async stop() {
        this.stopping = true
        this.connected = false
        clearTimeout(this.reconnectTimer)
        clearTimeout(this.retentionTimer)
        this.socket?.close(1000, 'Bot shutting down')
        await Promise.allSettled([...this.queueByTicket.values()])
        await this.state.save()
    }

    async handleComponent(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction) {
        if (interaction.isButton()) return this.handleButton(interaction)
        if (interaction.isStringSelectMenu()) return this.handleHistorySelection(interaction)
        if (interaction.isModalSubmit()) return this.handleModal(interaction)
    }

    private async handleButton(interaction: ButtonInteraction) {
        const [scope, action, value] = interaction.customId.split(':')
        if (scope !== 'support-ticket') return
        if (action === 'create') {
            const subject = new TextInputBuilder().setCustomId('subject').setLabel('Subject').setStyle(TextInputStyle.Short).setMaxLength(160).setRequired(false)
            const message = new TextInputBuilder().setCustomId('message').setLabel('What do you need help with?').setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true)
            const modal = new ModalBuilder().setCustomId('support-ticket:create').setTitle('Create support ticket').addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(subject),
                new ActionRowBuilder<TextInputBuilder>().addComponents(message),
            )
            await interaction.showModal(modal)
            return
        }
        if (action === 'link') {
            const code = new TextInputBuilder().setCustomId('code').setLabel('Hanasand link code').setStyle(TextInputStyle.Short).setMinLength(16).setMaxLength(16).setRequired(true)
            const modal = new ModalBuilder().setCustomId('support-ticket:link').setTitle('Connect Hanasand account').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(code))
            await interaction.showModal(modal)
            return
        }
        if (action === 'history') return this.showHistoryPage(interaction, 0, false)
        if (action === 'history-page') return this.showHistoryPage(interaction, Number(value), true)
        if ((action === 'resolve' || action === 'reopen') && value && uuidPattern.test(value)) return this.changeTicketStatus(interaction, value, action === 'reopen' ? 'open' : 'closed')
    }

    private async handleHistorySelection(interaction: StringSelectMenuInteraction) {
        if (interaction.customId !== 'support-ticket:history-select') return
        const ticketId = interaction.values[0]
        if (!ticketId || !uuidPattern.test(ticketId)) {
            await interaction.reply({ content: 'Choose a valid ticket from your history.', flags: MessageFlags.Ephemeral })
            return
        }
        await interaction.deferUpdate()
        try {
            const channel = await this.openTicket(interaction.user.id, ticketId)
            await interaction.editReply({ content: `Ticket restored in <#${channel.id}>.`, embeds: [], components: [], allowedMentions: { parse: [] } })
        } catch (error) {
            const content = this.describeApiError(error)
            await interaction.editReply({ content, embeds: [], components: [], allowedMentions: { parse: [] } })
        }
    }

    private async handleModal(interaction: ModalSubmitInteraction) {
        if (interaction.customId !== 'support-ticket:create' && interaction.customId !== 'support-ticket:link') return
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        try {
            if (interaction.customId === 'support-ticket:link') {
                await this.api.discordAction({ action: 'link', discordUserId: interaction.user.id, code: interaction.fields.getTextInputValue('code').trim().toUpperCase() })
                await interaction.editReply('Your Hanasand account is connected. You can create and restore support tickets here.')
                return
            }
            const created = await this.api.discordAction({
                action: 'create',
                discordUserId: interaction.user.id,
                subject: interaction.fields.getTextInputValue('subject').trim() || 'Support question',
                message: interaction.fields.getTextInputValue('message').trim(),
            })
            if (typeof created !== 'object' || created === null || !('id' in created) || typeof created.id !== 'string' || !uuidPattern.test(created.id)) {
                throw new SupportApiError(502, 'Website support did not return the new ticket.')
            }
            const channel = await this.openTicket(interaction.user.id, created.id)
            await interaction.editReply({ content: `Your support chat is open in <#${channel.id}>.`, allowedMentions: { parse: [] } })
        } catch (error) {
            await interaction.editReply({ content: this.describeApiError(error), allowedMentions: { parse: [] } })
        }
    }

    private async showHistoryPage(interaction: ButtonInteraction, page: number, update: boolean) {
        if (!Number.isSafeInteger(page) || page < 0 || page > 10_000) return
        try {
            const history = await this.api.getDiscordTickets(interaction.user.id, page)
            const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('Your Hanasand support history')
            if (!history.tickets.length) {
                embed.setDescription(page ? 'There are no more tickets in your history.' : 'No support tickets yet. Choose **Create ticket** to start a chat.')
                const components = page ? [this.historyNavigation(page, false)] : []
                if (update) await interaction.update({ embeds: [embed], components })
                else await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } })
                return
            }
            embed.setDescription(history.tickets.map(ticket => `**${ticket.status === 'closed' ? 'Resolved' : 'Open'}** · ${ticket.subject.slice(0, 80)} · ${ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : 'date unavailable'}`).join('\n'))
            const options = history.tickets.map(ticket => ({
                label: `${ticket.status === 'closed' ? 'Resolved · ' : ''}${ticket.subject || 'Support ticket'}`.slice(0, 100),
                description: `Created ${ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : 'date unavailable'}`.slice(0, 100),
                value: ticket.id,
            }))
            const picker = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
                .setCustomId('support-ticket:history-select').setPlaceholder('Open or restore a ticket').addOptions(options))
            const components = [picker, ...(page || history.hasMore ? [this.historyNavigation(page, history.hasMore)] : [])]
            if (update) await interaction.update({ embeds: [embed], components, allowedMentions: { parse: [] } })
            else await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } })
        } catch (error) {
            const response = { content: this.describeApiError(error), embeds: [], components: [], allowedMentions: { parse: [] } }
            if (update) await interaction.update(response)
            else await interaction.reply({ ...response, flags: MessageFlags.Ephemeral })
        }
    }

    private historyNavigation(page: number, hasMore: boolean) {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`support-ticket:history-page:${Math.max(0, page - 1)}`).setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
            new ButtonBuilder().setCustomId(`support-ticket:history-page:${page + 1}`).setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(!hasMore),
        )
    }

    private describeApiError(error: unknown) {
        if (error instanceof SupportApiError) return error.message
        return error instanceof Error ? error.message.slice(0, 240) : 'The support action could not be completed.'
    }

    private async openTicket(discordUserId: string, ticketId: string) {
        const { ticket, isOwner } = await this.api.restoreDiscordTicket(discordUserId, ticketId)
        if (!isOwner && !await this.isSupportMember(discordUserId)) throw new SupportApiError(403, 'Only the ticket owner or a member of Hanasand Support can restore this ticket.')
        let opened: TextChannel | undefined
        await this.enqueue(ticket.id, async () => {
            let saved = this.state.get(ticket.id)
            const wasArchived = saved?.archived === true
            if (!saved) saved = { channelId: '', status: ticket.status, mirroredMessageIds: [], handledDiscordMessageIds: [] }
            if (wasArchived) {
                saved.mirroredMessageIds = []
                saved.removeAt = new Date(Date.now() + retentionMs).toISOString()
                saved.resolvedAt ||= ticket.resolved_at || new Date().toISOString()
            }
            saved.archived = false
            if (isOwner) saved.requesterDiscordId = discordUserId
            this.state.set(ticket.id, saved)
            const { channel, created } = await this.ensureChannel(ticket, saved, true)
            if (created && saved.mirroredMessageIds.length) saved.mirroredMessageIds = []
            if (ticket.status === 'closed') {
                saved.resolvedAt ||= ticket.resolved_at || new Date().toISOString()
                if (!saved.removeAt || Date.parse(saved.removeAt) <= Date.now()) {
                    const originalRemoval = Date.parse(saved.resolvedAt) + retentionMs
                    saved.removeAt = new Date(originalRemoval > Date.now() ? originalRemoval : Date.now() + retentionMs).toISOString()
                }
            } else {
                delete saved.resolvedAt
                delete saved.removeAt
            }
            saved.status = ticket.status
            await this.prepareSupportChannel(channel, ticket, saved)
            await this.ensureChannelHeader(channel, ticket, saved, created)
            this.ticketByChannel.set(channel.id, ticket.id)
            const messages = await this.api.getMessages(ticket.id)
            for (const message of messages) {
                if (saved.mirroredMessageIds.includes(message.id)) continue
                await this.sendWebsiteMessage(channel, message)
                saved.mirroredMessageIds.push(message.id)
            }
            await this.state.save()
            opened = channel
            this.scheduleRetentionCleanup()
        })
        if (!opened) throw new Error('The support channel could not be opened.')
        return opened
    }

    private async changeTicketStatus(interaction: ButtonInteraction, ticketId: string, status: 'open' | 'closed') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        try {
            if (!await this.isSupportMember(interaction.user.id, interaction.member)) {
                await interaction.editReply('Only members of the Hanasand Support role can resolve or reopen tickets.')
                return
            }
            const result = await this.api.discordAction({ action: 'status', discordUserId: interaction.user.id, ticketId, status })
            await this.syncTicket(ticketId)
            const saved = this.state.get(ticketId)
            if (status === 'closed' && saved?.removeAt) {
                const epoch = Math.floor(Date.parse(saved.removeAt) / 1000)
                await interaction.editReply(`Ticket resolved. This Discord channel will be removed <t:${epoch}:F> (<t:${epoch}:R>). You can restore it from /tickets.`)
            } else if (status === 'closed' && typeof result === 'object' && result !== null && 'ticket' in result) {
                const ticket = (result as { ticket?: { resolved_at?: string } }).ticket
                const epoch = Math.floor((Date.parse(ticket?.resolved_at || '') + retentionMs) / 1000)
                await interaction.editReply(`Ticket resolved. This Discord channel will be removed <t:${epoch}:F> (<t:${epoch}:R>). You can restore it from /tickets.`)
            } else {
                await interaction.editReply('Ticket reopened. Replies in this channel will sync with Hanasand.')
            }
        } catch (error) {
            await interaction.editReply(this.describeApiError(error))
        }
    }

    private scheduleRetentionCleanup() {
        clearTimeout(this.retentionTimer)
        this.retentionTimer = undefined
        if (this.stopping) return
        const deadlines = this.state.entries().map(([, ticket]) => ticket.status === 'closed' && !ticket.archived && ticket.removeAt ? Date.parse(ticket.removeAt) : Number.NaN)
            .filter(Number.isFinite)
        if (!deadlines.length) return
        const delay = Math.min(2_147_000_000, Math.max(0, Math.min(...deadlines) - Date.now()))
        this.retentionTimer = setTimeout(() => { void this.archiveDueChannels() }, delay)
    }

    private async archiveDueChannels() {
        this.retentionTimer = undefined
        try {
            const guild = await this.getGuild()
            for (const [ticketId, saved] of this.state.entries()) {
                if (saved.status !== 'closed' || saved.archived || !saved.removeAt || Date.parse(saved.removeAt) > Date.now()) continue
                const channel = await guild.channels.fetch(saved.channelId).catch(() => null)
                if (channel) await channel.delete('Resolved Hanasand support channel reached its 24-hour retention deadline')
                this.ticketByChannel.delete(saved.channelId)
                saved.archived = true
                await this.state.save()
                console.log(`Archived resolved Discord support ticket ${ticketId} from the server.`)
            }
        } catch (error) {
            console.error('Could not remove a resolved Discord support channel:', error instanceof Error ? error.message : 'unknown error')
            this.retentionTimer = setTimeout(() => { void this.archiveDueChannels() }, 60_000)
            return
        }
        this.scheduleRetentionCleanup()
    }

    private connect() {
        if (this.stopping) return
        const url = new URL('/api/ws/support', this.config.apiBase)
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
        const socket = new WebSocket(url, {
            headers: { origin: 'https://hanasand.com' },
            handshakeTimeout: 5_000,
            maxPayload: 4096,
            perMessageDeflate: false,
        })
        this.socket = socket
        socket.on('open', () => {
            socket.send(JSON.stringify({ type: 'auth', apiKey: this.config.supportApiKey }))
        })
        socket.on('message', raw => this.onStreamMessage(socket, raw.toString()))
        socket.on('error', () => console.warn('Support stream connection failed; reconnecting.'))
        socket.on('close', () => {
            if (this.socket === socket) this.connected = false
            if (this.socket === socket && !this.stopping) this.scheduleReconnect()
        })
    }

    private onStreamMessage(socket: WebSocket, raw: string) {
        if (this.socket !== socket) return
        let event: ChangeEvent
        try { event = JSON.parse(raw) as ChangeEvent } catch { return }
        if (event.type === 'ready') {
            this.connected = true
            this.reconnectAttempt = 0
            void this.syncQueue()
            return
        }
        if (event.type !== 'changed') return
        if (typeof event.id === 'string' && uuidPattern.test(event.id)) void this.syncTicket(event.id)
        else void this.syncQueue()
    }

    private scheduleReconnect() {
        if (this.reconnectTimer || this.stopping) return
        const base = Math.min(30_000, 250 * (2 ** Math.min(this.reconnectAttempt, 7)))
        const delay = base + Math.floor(Math.random() * 250)
        this.reconnectAttempt++
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined
            this.connect()
        }, delay)
    }

    private async getGuild() {
        if (this.guild) return this.guild
        const guild = await this.client.guilds.fetch(this.config.guildId)
        if (!this.config.supportRoleId) throw new Error('DISCORD_SUPPORT_ROLE_ID must identify the private support-access role.')
        this.supportRole = await guild.roles.fetch(this.config.supportRoleId) || undefined
        if (!this.supportRole) throw new Error('DISCORD_SUPPORT_ROLE_ID does not exist in the configured server.')
        const channels = await guild.channels.fetch()
        if (this.config.supportCategoryId) {
            const category = channels.get(this.config.supportCategoryId)
            if (!category || category.type !== ChannelType.GuildCategory) throw new Error('DISCORD_SUPPORT_CATEGORY_ID must be a category in the configured server.')
            this.supportCategoryId = category.id
        } else {
            const supportCategory = [...channels.values()].find(channel => channel?.type === ChannelType.GuildCategory
                && channel.name.toLowerCase() === 'support')
            if (!supportCategory) throw new Error('Create a Discord category named support or set DISCORD_SUPPORT_CATEGORY_ID.')
            this.supportCategoryId = supportCategory.id
        }
        this.guild = guild
        return guild
    }

    private enqueue(ticketId: string, work: () => Promise<void>) {
        const pending = (this.queueByTicket.get(ticketId) || Promise.resolve())
            .then(work)
            .catch(error => console.error(`Support ticket ${ticketId} could not sync:`, error instanceof Error ? error.message : 'unknown error'))
        this.queueByTicket.set(ticketId, pending)
        void pending.then(() => { if (this.queueByTicket.get(ticketId) === pending) this.queueByTicket.delete(ticketId) })
        return pending
    }

    private async syncQueue() {
        try {
            const tickets = (await this.api.getTickets()).sort((left, right) => left.created_at.localeCompare(right.created_at))
            for (const ticket of tickets) {
                const saved = this.state.get(ticket.id)
                if (ticket.channel === 'human' && (ticket.status === 'open' || saved)) await this.syncTicketRecord(ticket)
            }
        } catch (error) {
            console.error('Support queue sync failed:', error instanceof Error ? error.message : 'unknown error')
        }
    }

    private async syncTicket(ticketId: string) {
        return this.enqueue(ticketId, async () => {
            const tickets = await this.api.getTickets()
            const ticket = tickets.find(item => item.id === ticketId)
            if (ticket) await this.processTicket(ticket)
        })
    }

    private syncTicketRecord(ticket: SupportTicket) {
        return this.enqueue(ticket.id, () => this.processTicket(ticket))
    }

    private async processTicket(ticket: SupportTicket) {
        if (ticket.channel !== 'human') return
        let saved = this.state.get(ticket.id)
        if (!saved && ticket.status === 'closed') return
        if (saved?.archived && ticket.status === 'closed') return
        const previousStatus = saved?.status
        const { channel, created } = await this.ensureChannel(ticket, saved)
        saved = this.state.get(ticket.id)!
        if (created && saved.mirroredMessageIds.length) saved.mirroredMessageIds = []
        if (ticket.status === 'closed') {
            if (previousStatus !== 'closed' || !saved.resolvedAt) {
                saved.resolvedAt = ticket.resolved_at || ticket.updated_at || new Date().toISOString()
                saved.removeAt = new Date(Date.parse(saved.resolvedAt) + retentionMs).toISOString()
                saved.archived = false
            } else if (!saved.removeAt) {
                saved.resolvedAt ||= ticket.resolved_at || ticket.updated_at || new Date().toISOString()
                saved.removeAt = new Date(Date.parse(saved.resolvedAt) + retentionMs).toISOString()
            }
        } else {
            delete saved.resolvedAt
            delete saved.removeAt
            saved.archived = false
        }
        saved.status = ticket.status
        this.ticketByChannel.set(channel.id, ticket.id)
        await this.prepareSupportChannel(channel, ticket, saved)
        await this.state.save()

        await this.ensureChannelHeader(channel, ticket, saved, created)
        const messages = await this.api.getMessages(ticket.id)
        for (const message of messages) {
            if (saved.mirroredMessageIds.includes(message.id)) continue
            await this.sendWebsiteMessage(channel, message)
            saved.mirroredMessageIds.push(message.id)
            await this.state.save()
        }
        if (!this.replayedTickets.has(ticket.id)) {
            this.replayedTickets.add(ticket.id)
            void this.replayRecentStaffMessages(channel, ticket.id)
        }
        this.scheduleRetentionCleanup()
    }

    private async ensureChannel(ticket: SupportTicket, existing?: TicketState, forceRestore = false) {
        const guild = await this.getGuild()
        if (existing && !existing.archived) {
            const savedChannel = await guild.channels.fetch(existing.channelId).catch(() => null)
            if (channelIsText(savedChannel)) {
                if (!existing.requesterDiscordId && ticket.requester_discord_id) existing.requesterDiscordId = ticket.requester_discord_id
                return { channel: savedChannel, created: false }
            }
        }

        const found = [...guild.channels.cache.values()].find(channel => channelIsText(channel)
            && channel.topic?.includes(`${ticketMarker}${ticket.id}`))
        if (found && channelIsText(found)) {
            const saved = existing ? { ...existing, channelId: found.id } : {
                channelId: found.id,
                status: ticket.status,
                mirroredMessageIds: [],
                handledDiscordMessageIds: [],
            }
            if (!saved.requesterDiscordId && ticket.requester_discord_id) saved.requesterDiscordId = ticket.requester_discord_id
            saved.archived = false
            this.state.set(ticket.id, saved)
            await this.state.save()
            return { channel: found, created: false }
        }
        if (ticket.status === 'closed' && !forceRestore) throw new Error('Closed support channel was removed; use ticket history to restore it.')

        const saved = existing || {
            channelId: '',
            status: ticket.status,
            mirroredMessageIds: [],
            handledDiscordMessageIds: [],
        }
        if (!saved.requesterDiscordId && ticket.requester_discord_id) saved.requesterDiscordId = ticket.requester_discord_id
        const number = saved.channelNumber || this.state.allocateChannelNumber()
        saved.channelNumber = number
        saved.status = ticket.status
        saved.archived = false
        const channel = await guild.channels.create({
            name: ticketChannelName(number, ticket.first_message || ticket.subject),
            type: ChannelType.GuildText,
            parent: this.supportCategoryId!,
            topic: `${ticketMarker}${ticket.id}`,
            permissionOverwrites: this.supportPermissionOverwrites(guild, ticket.status, saved.requesterDiscordId),
            reason: 'Open a private channel for a Hanasand website support chat',
        })
        saved.channelId = channel.id
        this.state.set(ticket.id, saved)
        await this.state.save()
        return { channel, created: true }
    }

    private supportPermissionOverwrites(guild: Guild, status: SupportTicket['status'], requesterDiscordId?: string) {
        if (!this.supportRole) throw new Error('The Hanasand support role is not configured.')
        const overwrites: OverwriteData[] = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: this.supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] },
        ]
        if (requesterDiscordId) overwrites.push({
            id: requesterDiscordId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, ...(status === 'open' ? [PermissionFlagsBits.SendMessages] : [])],
            ...(status === 'closed' ? { deny: [PermissionFlagsBits.SendMessages] } : {}),
        })
        return overwrites
    }

    private async prepareSupportChannel(channel: TextChannel, ticket: SupportTicket, saved: TicketState) {
        const guild = await this.getGuild()
        const number = saved.channelNumber || this.state.allocateChannelNumber()
        saved.channelNumber = number
        if (this.supportCategoryId && channel.parentId !== this.supportCategoryId) {
            await channel.setParent(this.supportCategoryId, { lockPermissions: false, reason: 'Keep Hanasand support chats under the support category' })
        }
        const desired = this.supportPermissionOverwrites(guild, ticket.status, saved.requesterDiscordId)
        const overwrites = channel.permissionOverwrites.cache
        const everyone = overwrites.get(guild.roles.everyone.id)
        const support = overwrites.get(this.supportRole!.id)
        const supportPermissions = PermissionFlagsBits.ViewChannel
            | PermissionFlagsBits.SendMessages
            | PermissionFlagsBits.ReadMessageHistory
            | PermissionFlagsBits.EmbedLinks
        let requester = saved.requesterDiscordId ? overwrites.get(saved.requesterDiscordId) : undefined
        const requesterPermissions = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory
            | (ticket.status === 'open' ? PermissionFlagsBits.SendMessages : 0n)
        if (saved.requesterDiscordId && (!requester || !requester.allow.has(PermissionFlagsBits.ViewChannel))) {
            try {
                await channel.permissionOverwrites.edit(saved.requesterDiscordId, {
                    ViewChannel: true,
                    ReadMessageHistory: true,
                    SendMessages: ticket.status === 'open',
                }, { reason: 'Grant the linked ticket owner access to their Hanasand support chat' })
                requester = channel.permissionOverwrites.cache.get(saved.requesterDiscordId)
            } catch {
                this.warnPermissionMismatch(ticket.id)
            }
        }
        const correctOverwrites = overwrites.size === (saved.requesterDiscordId ? 3 : 2)
            && everyone?.allow.bitfield === 0n
            && everyone.deny.bitfield === PermissionFlagsBits.ViewChannel
            && support?.allow.bitfield === supportPermissions
            && support.deny.bitfield === 0n
            && (!saved.requesterDiscordId || requester?.allow.bitfield === requesterPermissions && requester.deny.bitfield === (ticket.status === 'closed' ? PermissionFlagsBits.SendMessages : 0n))
        if (!correctOverwrites) {
            const supportCanView = Boolean(support && support.allow.has(PermissionFlagsBits.ViewChannel)
                && !support.deny.has(PermissionFlagsBits.ViewChannel))
            const hasSafeSupportAccess = everyone?.deny.has(PermissionFlagsBits.ViewChannel) && supportCanView
            const botMember = guild.members.me
            if (botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
                await channel.permissionOverwrites.set(desired, 'Limit Hanasand support chats to Support and the linked ticket owner').catch(error => {
                    if (!hasSafeSupportAccess) throw error
                    this.warnPermissionMismatch(ticket.id)
                })
            } else if (hasSafeSupportAccess) {
                // Existing channels may use the Support role's server-level send/history grants and be uneditable by the bot.
                this.warnPermissionMismatch(ticket.id)
            } else {
                throw new Error('This support channel does not grant private access to the Support role and linked ticket owner.')
            }
        }
        const name = ticketChannelName(number, ticket.first_message || ticket.subject)
        if (channel.name !== name) await channel.setName(name, 'Use the Hanasand support ticket number and first message')
        this.state.set(ticket.id, saved)
        await this.state.save()
    }

    private warnPermissionMismatch(ticketId: string) {
        if (this.permissionWarnings.has(ticketId)) return
        this.permissionWarnings.add(ticketId)
        console.warn(`Support ticket ${ticketId} has manually managed channel permissions; the bot will leave them unchanged.`)
    }

    private ticketHeader(ticket: SupportTicket, saved: TicketState) {
        const embed = new EmbedBuilder()
            .setColor(ticket.status === 'closed' ? 0x57f287 : 0x5865f2)
            .setTitle(ticket.subject.trim().slice(0, 256) || 'Website support')
            .setDescription(ticket.status === 'closed'
                ? `**Resolved**\nThis Discord channel will be removed <t:${Math.floor(Date.parse(saved.removeAt || new Date().toISOString()) / 1000)}:F> (<t:${Math.floor(Date.parse(saved.removeAt || new Date().toISOString()) / 1000)}:R>). The ticket remains in your Hanasand history and can be restored from /tickets.\nTicket: \`${ticket.id}\``
                : `Open website support conversation\nTicket: \`${ticket.id}\``)
            .setFooter({ text: ticket.status === 'closed' ? `Resolved ${saved.resolvedAt ? new Date(saved.resolvedAt).toLocaleString('en-GB', { timeZone: 'UTC', timeZoneName: 'short' }) : ''}`.trim() : `Hanasand Support · ${ticket.id}` })
        if (ticket.status === 'closed' && saved.resolvedAt) embed.setTimestamp(new Date(saved.resolvedAt))
        return embed
    }

    private ticketActionRow(ticket: SupportTicket) {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
            .setCustomId(`support-ticket:${ticket.status === 'closed' ? 'reopen' : 'resolve'}:${ticket.id}`)
            .setLabel(ticket.status === 'closed' ? 'Reopen ticket' : 'Resolve ticket')
            .setStyle(ticket.status === 'closed' ? ButtonStyle.Success : ButtonStyle.Secondary))
    }

    private async ensureChannelHeader(channel: TextChannel, ticket: SupportTicket, saved: TicketState, created: boolean) {
        const header = saved.headerMessageId ? await channel.messages.fetch(saved.headerMessageId).catch(() => null) : null
        if (header) {
            await header.edit({ embeds: [this.ticketHeader(ticket, saved)], components: [this.ticketActionRow(ticket)], allowedMentions: { parse: [] } })
            return
        }
        if (!created && saved.headerMessageId) delete saved.headerMessageId
        const message = await channel.send({ embeds: [this.ticketHeader(ticket, saved)], components: [this.ticketActionRow(ticket)], allowedMentions: { parse: [] } })
        saved.headerMessageId = message.id
        await this.state.save()
    }

    private async sendWebsiteMessage(channel: TextChannel, message: SupportMessage) {
        const author = supportAuthor(message).replace(/[\r\n]/g, ' ').slice(0, 80)
        const parts = splitMessage(message.body)
        for (let index = 0; index < parts.length; index++) {
            const label = index === 0 ? `**${author}**` : `**${author} (continued)**`
            await channel.send({
                content: `${label}\n${parts[index]}`,
                allowedMentions: { parse: [] },
            })
        }
    }

    private async replayRecentStaffMessages(channel: TextChannel, ticketId: string) {
        try {
            const history = await channel.messages.fetch({ limit: 100 })
            for (const message of [...history.values()].sort((left, right) => left.createdTimestamp - right.createdTimestamp)) {
                if (message.author.bot || message.webhookId) continue
                void this.forwardDiscordMessage(ticketId, message)
            }
        } catch (error) {
            console.error(`Could not check recent Discord replies for ticket ${ticketId}:`, error instanceof Error ? error.message : 'unknown error')
        }
    }

    private async onMessage(message: Message) {
        if (!message.guild || message.guild.id !== this.config.guildId || message.author.bot || message.webhookId) return
        const ticketId = this.ticketByChannel.get(message.channelId)
        if (!ticketId) return
        void this.forwardDiscordMessage(ticketId, message)
    }

    private async isSupportMember(userId: string, member?: unknown) {
        const guild = await this.getGuild()
        const roles = member && typeof member === 'object' && 'roles' in member ? (member as { roles: unknown }).roles : undefined
        if (roles && typeof roles === 'object' && 'cache' in roles && (roles as { cache?: { has?: (id: string) => boolean } }).cache?.has) {
            return (roles as { cache: { has: (id: string) => boolean } }).cache.has(this.supportRole!.id)
        }
        if (Array.isArray(roles)) return roles.includes(this.supportRole!.id)
        const fetched = await guild.members.fetch(userId).catch(() => null)
        return Boolean(fetched?.roles.cache.has(this.supportRole!.id))
    }

    private async forwardDiscordMessage(ticketId: string, message: Message) {
        return this.enqueue(ticketId, async () => {
            const state = this.state.get(ticketId)
            if (!state || state.handledDiscordMessageIds.includes(message.id)) return
            const isSupportStaff = await this.isSupportMember(message.author.id, message.member)
            if (!isSupportStaff && state.requesterDiscordId !== message.author.id) {
                await message.reply({ content: 'Only the ticket owner and Hanasand Support can reply here.', allowedMentions: { parse: [] } })
                state.handledDiscordMessageIds.push(message.id)
                await this.state.save()
                return
            }
            const body = message.content.trim()
            if (!body) {
                await message.reply({ content: 'Send a text message to reply to the website chat.', allowedMentions: { parse: [] } })
                state.handledDiscordMessageIds.push(message.id)
                await this.state.save()
                return
            }
            if (state.status === 'closed') {
                await message.reply({ content: 'This ticket is resolved. A member of Hanasand Support can reopen it with the button above.', allowedMentions: { parse: [] } })
                state.handledDiscordMessageIds.push(message.id)
                await this.state.save()
                return
            }

            const requestId = makeRequestId(message.id)
            let lastError: unknown
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const result = await this.api.discordAction({ action: 'message', discordUserId: message.author.id, ticketId, message: body, requestId })
                    const responseMessageId = typeof result === 'object' && result !== null && 'messageId' in result
                        && typeof result.messageId === 'string' ? result.messageId : undefined
                    if (responseMessageId && !state.mirroredMessageIds.includes(responseMessageId)) state.mirroredMessageIds.push(responseMessageId)
                    state.handledDiscordMessageIds.push(message.id)
                    await this.state.save()
                    return
                } catch (error) {
                    lastError = error
                    const retryable = !(error instanceof SupportApiError) || error.status === 429 || error.status >= 500
                    if (!retryable || attempt === 2) break
                    await new Promise(resolve => setTimeout(resolve, 250 * (2 ** attempt)))
                }
            }
            const detail = lastError instanceof Error ? lastError.message.slice(0, 240) : 'Unknown website error.'
            await message.reply({ content: `The message was not sent to the website: ${detail}`, allowedMentions: { parse: [] } })
            if (lastError instanceof SupportApiError && lastError.status < 500 && lastError.status !== 429) {
                state.handledDiscordMessageIds.push(message.id)
                await this.state.save()
            }
        })
    }

}
