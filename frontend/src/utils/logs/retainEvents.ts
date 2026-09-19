export function retainEvents<T extends { id: string, event_timestamp: string }>(previous: T[], incoming: T[]) {
    const events = new Map(previous.map(event => [event.id, event]))
    for (const event of incoming) events.set(event.id, event)
    return [...events.values()].sort((a, b) => Date.parse(b.event_timestamp) - Date.parse(a.event_timestamp)).slice(0, 5000)
}
