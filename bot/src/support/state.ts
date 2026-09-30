import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type TicketState = {
    channelId: string
    status: 'open' | 'closed'
    mirroredMessageIds: string[]
    handledDiscordMessageIds: string[]
}

type StateFile = { version: 1; tickets: Record<string, TicketState> }

function isTicketState(value: unknown): value is TicketState {
    return typeof value === 'object' && value !== null
        && typeof (value as TicketState).channelId === 'string'
        && ((value as TicketState).status === 'open' || (value as TicketState).status === 'closed')
        && Array.isArray((value as TicketState).mirroredMessageIds)
        && Array.isArray((value as TicketState).handledDiscordMessageIds)
}

export class SupportState {
    private readonly state: StateFile = { version: 1, tickets: {} }
    private writeQueue: Promise<void> = Promise.resolve()

    private constructor(private readonly path: string) {}

    static async load(path: string) {
        const store = new SupportState(path)
        try {
            const saved: unknown = JSON.parse(await readFile(path, 'utf8'))
            if (typeof saved === 'object' && saved !== null && (saved as StateFile).version === 1
                && typeof (saved as StateFile).tickets === 'object' && (saved as StateFile).tickets !== null) {
                for (const [id, value] of Object.entries((saved as StateFile).tickets)) {
                    if (isTicketState(value)) store.state.tickets[id] = value
                }
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
