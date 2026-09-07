import { describe, expect, test } from 'bun:test'
import { parseLogLine, type RuntimeContainer } from '../src/utils/docker/engine'

const container: RuntimeContainer = { id: 'db-id', name: 'database', image: 'postgres', state: 'running', status: 'Up', created_at: '2026-01-01T00:00:00Z' }
const timestamp = '2026-07-03T03:07:17.672614173Z'

describe('runtime log messages', () => {
    test('ignores timestamp-only Docker output instead of making it a new event', () => {
        for (const line of ['', '   ', timestamp, `${timestamp} `, `${timestamp}\n`]) {
            expect(parseLogLine(line, container)).toBeNull()
        }
    })

    test('keeps the actual message and Docker event time', () => {
        const log = parseLogLine(`${timestamp} database system is ready to accept connections`, container)!
        expect(log.created_at).toBe(timestamp)
        expect(log.message).toBe('database system is ready to accept connections')
        expect(log.level).toBe('info')
    })

    test('does not repeat a PostgreSQL timestamp in the message', () => {
        const log = parseLogLine(`${timestamp} 2026-07-03 03:07:17.672 UTC [123] ERROR: relation does not exist`, container)!
        expect(log.created_at).toBe(timestamp)
        expect(log.message).toBe('[123] ERROR: relation does not exist')
        expect(log.level).toBe('error')
    })

    test('unwraps structured messages after the Docker timestamp', () => {
        const log = parseLogLine(`${timestamp} {"time":"2026-07-03T03:07:17Z","msg":"request completed"}`, container)!
        expect(log.created_at).toBe(timestamp)
        expect(log.message).toBe('request completed')
    })

    test('retains standalone structured logs and skips empty structured messages', () => {
        expect(parseLogLine(`{"timestamp":"${timestamp}","message":"warning: retrying"}`, container)).toMatchObject({ created_at: timestamp, message: 'warning: retrying', level: 'warn' })
        expect(parseLogLine(`${timestamp} {"log":"  "}`, container)).toBeNull()
    })

    test('preserves untimestamped output and timestamp-like content within messages', () => {
        expect(parseLogLine('null', container)?.message).toBe('null')
        expect(parseLogLine('worker started', container)?.message).toBe('worker started')
        expect(parseLogLine(`${timestamp} next run: 2026-07-04T00:00:00Z`, container)?.message).toBe('next run: 2026-07-04T00:00:00Z')
    })
})
