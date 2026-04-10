import run from '#db'

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export default async function recordLog({
    service = process.env.SERVICE_NAME || 'hanasand-api',
    host = process.env.HOSTNAME || 'local',
    level,
    message,
    metadata = {},
}: {
    service?: string
    host?: string
    level: LogLevel
    message: string
    metadata?: Record<string, unknown>
}) {
    await run(`
        INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ($1, $2, $3, $4, $5::jsonb)
    `, [service, host, level, message, JSON.stringify(metadata)])
}
