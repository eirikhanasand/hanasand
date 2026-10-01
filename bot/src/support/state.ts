import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type TicketState = {
    channelId: string
    channelNumber?: number
    status: 'open' | 'closed'
    resolvedAt?: string
    removeAt?: string
    archived?: boolean
    requesterDiscordId?: string
    headerMessageId?: string
    mirroredMessageIds: string[]
    handledDiscordMessageIds: string[]
}

type StateFile = { version: 1; nextChannelNumber: number; tickets: Record<string, TicketState> }

function isTicketState(value: unknown): value is TicketState {
    return typeof value === 'object' && value !== null
        && typeof (value as TicketState).channelId === 'string'
        && ((value as TicketState).channelNumber === undefined || Number.isSafeInteger((value as TicketState).channelNumber) && (value as TicketState).channelNumber! > 0)
        && ((value as TicketState).status === 'open' || (value as TicketState).status === 'closed')
        && ((value as TicketState).resolvedAt === undefined || typeof (value as TicketState).resolvedAt === 'string')
        && ((value as TicketState).removeAt === undefined || typeof (value as TicketState).removeAt === 'string')
        && ((value as TicketState).archived === undefined || typeof (value as TicketState).archived === 'boolean')
        && ((value as TicketState).requesterDiscordId === undefined || typeof (value as TicketState).requesterDiscordId === 'string')
        && ((value as TicketState).headerMessageId === undefined || typeof (value as TicketState).headerMessageId === 'string')
        && Array.isArray((value as TicketState).mirroredMessageIds)
        && Array.isArray((value as TicketState).handledDiscordMessageIds)
}

export class SupportState {
    private readonly state: StateFile = { version: 1, nextChannelNumber: 1, tickets: {} }
    private writeQueue: Promise<void> = Promise.resolve()

    private constructor(private readonly path: string) {}

    static async load(path: string) {
        const store = new SupportState(path)
        try {
            const saved: unknown = JSON.parse(await readFile(path, 'utf8'))
            if (typeof saved === 'object' && saved !== null && (saved as StateFile).version === 1
                && typeof (saved as StateFile).tickets === 'object' && (saved as StateFile).tickets !== null) {
                const nextChannelNumber = (saved as Partial<StateFile>).nextChannelNumber
                if (Number.isSafeInteger(nextChannelNumber) && nextChannelNumber! > 0) store.state.nextChannelNumber = nextChannelNumber!
                for (const [id, value] of Object.entries((saved as StateFile).tickets)) {
                    if (isTicketState(value)) store.state.tickets[id] = value
                }
                const highestNumber = Math.max(0, ...Object.values(store.state.tickets).map(ticket => ticket.channelNumber || 0))
                store.state.nextChannelNumber = Math.max(store.state.nextChannelNumber, highestNumber + 1)
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        return store
    }

    get(ticketId: string) {
        return this.state.tickets[ticketId]
    }

    set(ticketId: string, value: TicketState) {
        this.state.tickets[ticketId] = value
    }

    allocateChannelNumber() {
        if (!Number.isSafeInteger(this.state.nextChannelNumber)) throw new Error('The next Hanasand support channel number is invalid.')
        const number = this.state.nextChannelNumber++
        return number
    }

    entries() {
        return Object.entries(this.state.tickets)
    }

    async save() {
        const contents = JSON.stringify(this.state)
        this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
            await mkdir(dirname(this.path), { recursive: true })
            const temporary = `${this.path}.${process.pid}.tmp`
            await writeFile(temporary, contents, { encoding: 'utf8', mode: 0o600 })
            await rename(temporary, this.path)
        })
        await this.writeQueue
    }
}
