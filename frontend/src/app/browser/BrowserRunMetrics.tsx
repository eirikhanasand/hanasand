export type RunMetrics = { event?: string; fps?: number; latencyMs?: number; capacity?: { activeSessions?: number; maxSessions?: number } | null }

export default function BrowserRunMetrics({ metrics }: { metrics: RunMetrics }) {
    return <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ui-muted'>
        {metrics.capacity ? <span aria-label='Browser capacity' title='Active browser sessions'>{metrics.capacity.activeSessions ?? 0}/{metrics.capacity.maxSessions ?? 100}</span> : null}
        <span>{metrics.event}{metrics.fps !== undefined ? ` · ${Math.round(metrics.fps)} FPS` : ''}{metrics.latencyMs !== undefined ? <> · <span title='Ping' aria-label={`Ping: ${Math.round(metrics.latencyMs)} milliseconds`}>{Math.round(metrics.latencyMs)}ms</span></> : null}</span>
    </div>
}
