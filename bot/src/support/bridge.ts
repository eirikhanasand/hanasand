import { createHash } from 'node:crypto'
import { ChannelType, EmbedBuilder, Events, PermissionFlagsBits, type Client, type Guild, type Message, type TextChannel } from 'discord.js'
import WebSocket from 'ws'
import type { BotConfig } from '../config.js'
import { SupportApi, SupportApiError, type SupportMessage, type SupportTicket } from './api.js'
import { SupportState, type TicketState } from './state.js'

const ticketMarker = 'hanasand-support-ticket:'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
    private connected = false
    private stopping = false
    private reconnectTimer: NodeJS.Timeout | undefined
    private reconnectAttempt = 0
    private readonly queueByTicket = new Map<string, Promise<void>>()
    private readonly ticketByChannel = new Map<string, string>()
    private readonly replayedTickets = new Set<string>()

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
    }

    async stop() {
        this.stopping = true
        this.connected = false
        clearTimeout(this.reconnectTimer)
        this.socket?.close(1000, 'Bot shutting down')
        await Promise.allSettled([...this.queueByTicket.values()])
        await this.state.save()
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
        if (this.config.supportRoleId && !await guild.roles.fetch(this.config.supportRoleId)) {
            throw new Error('DISCORD_SUPPORT_ROLE_ID does not exist in the configured server.')
        }
        const channels = await guild.channels.fetch()
        if (this.config.supportCategoryId) {
            const category = channels.get(this.config.supportCategoryId)
            if (!category || category.type !== ChannelType.GuildCategory) throw new Error('DISCORD_SUPPORT_CATEGORY_ID must be a category in the configured server.')
            this.supportCategoryId = category.id
        } else {
            const supportCategory = [...channels.values()].find(channel => channel?.type === ChannelType.GuildCategory
                && channel.name.toLowerCase() === 'support')
            this.supportCategoryId = supportCategory?.id
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
            const tickets = await this.api.getTickets()
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
        const { channel, created } = await this.ensureChannel(ticket, saved)
        saved = this.state.get(ticket.id)!
        saved.status = ticket.status
        this.ticketByChannel.set(channel.id, ticket.id)
        await this.state.save()

        if (created) await this.sendChannelHeader(channel, ticket)
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
    }

    private async ensureChannel(ticket: SupportTicket, existing?: TicketState) {
        const guild = await this.getGuild()
        if (existing) {
            const savedChannel = await guild.channels.fetch(existing.channelId).catch(() => null)
            if (channelIsText(savedChannel)) return { channel: savedChannel, created: false }
        }

        const found = [...guild.channels.cache.values()].find(channel => channelIsText(channel)
            && channel.topic?.includes(`${ticketMarker}${ticket.id}`))
        if (found && channelIsText(found)) {
            this.state.set(ticket.id, existing ? { ...existing, channelId: found.id } : {
                channelId: found.id,
                status: ticket.status,
                mirroredMessageIds: [],
                handledDiscordMessageIds: [],
            })
            await this.state.save()
            return { channel: found, created: false }
        }
        if (ticket.status === 'closed') throw new Error('Closed support channel no longer exists; refusing to recreate it.')

        const botId = this.client.user?.id
        if (!botId) throw new Error('Discord client is not ready.')
        const permissionOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: botId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] },
            { id: guild.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            ...(this.config.supportRoleId ? [{ id: this.config.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
        ]
        const channel = await guild.channels.create({
            name: `support-${ticket.id.slice(0, 8)}`,
            type: ChannelType.GuildText,
            ...(this.supportCategoryId ? { parent: this.supportCategoryId } : {}),
            topic: `${ticketMarker}${ticket.id}`,
            permissionOverwrites,
            reason: 'Open a private channel for a Hanasand website support chat',
        })
        this.state.set(ticket.id, {
            channelId: channel.id,
            status: ticket.status,
            mirroredMessageIds: [],
            handledDiscordMessageIds: existing?.handledDiscordMessageIds || [],
        })
        await this.state.save()
        return { channel, created: true }
    }

    private async sendChannelHeader(channel: TextChannel, ticket: SupportTicket) {
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(ticket.subject.trim().slice(0, 256) || 'Website support')
            .setDescription(`Private website support conversation\nTicket: \`${ticket.id}\``)
        await channel.send({ embeds: [embed], allowedMentions: { parse: [] } })
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
                void this.forwardStaffMessage(ticketId, message)
            }
        } catch (error) {
            console.error(`Could not check recent Discord replies for ticket ${ticketId}:`, error instanceof Error ? error.message : 'unknown error')
        }
    }

    private async onMessage(message: Message) {
        if (!message.guild || message.guild.id !== this.config.guildId || message.author.bot || message.webhookId) return
        const ticketId = this.ticketByChannel.get(message.channelId)
        if (!ticketId) return
        void this.forwardStaffMessage(ticketId, message)
    }

    private async isSupportStaff(message: Message) {
        const guild = await this.getGuild()
        if (message.author.id === guild.ownerId) return true
        const member = message.member || await guild.members.fetch(message.author.id).catch(() => null)
        if (!member) return false
        return member.permissions.has(PermissionFlagsBits.Administrator)
            || Boolean(this.config.supportRoleId && member.roles.cache.has(this.config.supportRoleId))
    }

    private async forwardStaffMessage(ticketId: string, message: Message) {
        return this.enqueue(ticketId, async () => {
            const state = this.state.get(ticketId)
            if (!state || state.handledDiscordMessageIds.includes(message.id)) return
            if (!await this.isSupportStaff(message)) {
                await message.reply({ content: 'Only the server owner, administrators, and configured support staff can reply to website chats.', allowedMentions: { parse: [] } })
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
                await message.reply({ content: 'This website chat is closed. Reopen it on Hanasand before replying.', allowedMentions: { parse: [] } })
                state.handledDiscordMessageIds.push(message.id)
                await this.state.save()
                return
            }

            const requestId = makeRequestId(message.id)
            let lastError: unknown
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const result = await this.api.postReply(ticketId, body, requestId)
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
            await message.reply({ content: `The reply was not sent to the website: ${detail}`, allowedMentions: { parse: [] } })
            if (lastError instanceof SupportApiError && lastError.status < 500 && lastError.status !== 429) {
                state.handledDiscordMessageIds.push(message.id)
                await this.state.save()
            }
        })
    }
}
