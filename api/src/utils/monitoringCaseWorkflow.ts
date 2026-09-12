type Row = Record<string, any>

export function monitoringCaseResolution(row: Row) {
    if (row.resolution) return row.resolution
    if (row.status_override === 'closed' || row.status_override === 'resolved') return { type: 'unknown', note: 'This case was closed before resolver attribution was recorded.' }
    if (row.resolved_at && !row.status_override) return { type: 'automation', actor: 'Health monitoring', at: row.resolved_at, note: 'The health check recovered automatically. The original recovery comment was not recorded.' }
    return null
}

export function monitoringCaseHistory(row: Row) {
    const history = [...(row.history || [])]
    const events = [{ id: `created-${row.id}`, at: row.first_seen_at, actor: 'Health monitoring', action: 'created', note: 'First recorded health-check failure or warning.' }, ...history]
    for (const comment of row.comments || []) {
        if (!history.some(event => event.id === comment.id)) events.push({ id: comment.id, at: comment.createdAt, actor: comment.author, action: 'commented', note: comment.body })
    }
    if (row.resolved_at && !history.some(event => event.action === 'recovered' && new Date(event.at).getTime() === new Date(row.resolved_at).getTime())) {
        events.push({ id: `legacy-recovery-${row.id}`, at: row.resolved_at, actor: 'Health monitoring', action: 'recovered', note: 'Recovered according to the stored health-check timestamp. Detailed history was not recorded at the time.' })
    }
    return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}
