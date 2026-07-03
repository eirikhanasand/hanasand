import { expect, test } from '@playwright/test'
import {
    containerCpuMetric,
    containerMemoryMetric,
    isFresh,
    normalizeDockerTelemetry,
    normalizeSystemTelemetry,
} from '@/app/dashboard/system/systemPresentation'

test('system dashboard normalizes legacy and enriched Docker telemetry', () => {
    const legacy = normalizeDockerTelemetry([{ id: 'abc123', name: 'api', status: 'running' }])
    expect(legacy.containers).toHaveLength(1)
    expect(legacy.source).toBe('legacy_array')

    const enriched = normalizeDockerTelemetry({
        containers: [{ id: 'def456', name: 'worker', status: 'running' }],
        source: 'docker_engine',
        generated_at: '2026-07-02T08:00:00.000Z',
    })
    expect(enriched.containers[0].name).toBe('worker')
    expect(enriched.generated_at).toBe('2026-07-02T08:00:00.000Z')
})

test('system dashboard preserves Docker telemetry unavailable reasons', () => {
    const telemetry = normalizeDockerTelemetry({
        containers: [],
        source: 'unavailable',
        docker_socket_available: false,
        unavailable_reason: 'Docker socket is unavailable at /var/run/docker.sock',
        generated_at: '2026-07-02T08:00:00.000Z',
    })

    expect(telemetry.containers).toEqual([])
    expect(telemetry.docker_socket_available).toBe(false)
    expect(telemetry.unavailable_reason).toContain('/var/run/docker.sock')
})

test('system dashboard preserves host telemetry unavailable reasons', () => {
    const telemetry = normalizeSystemTelemetry({
        system: null,
        unavailable_reason: 'System telemetry is unavailable.',
        generated_at: '2026-07-02T08:00:00.000Z',
    })

    expect(telemetry.system).toBeNull()
    expect(telemetry.unavailable_reason).toBe('System telemetry is unavailable.')
    expect(telemetry.generated_at).toBe('2026-07-02T08:00:00.000Z')
})

test('system dashboard explains unavailable container CPU and memory metrics', () => {
    const container = {
        id: 'abc123',
        name: 'api',
        status: 'running',
        stats_unavailable_reason: 'Docker socket is unavailable at /var/run/docker.sock',
    } satisfies DockerContainer

    expect(containerCpuMetric(container).value).toBe('Unavailable')
    expect(containerCpuMetric(container).reason).toContain('Docker socket')
    expect(containerMemoryMetric(container).value).toBe('Unavailable')
    expect(containerMemoryMetric(container).reason).toContain('Docker socket')
})

test('system dashboard formats real container resource stats', () => {
    const container = {
        id: 'abc123',
        name: 'api',
        status: 'running',
        stats: {
            cpu_percent: 3.244,
            memory_bytes: 256 * 1024 * 1024,
            memory_limit_bytes: 1024 * 1024 * 1024,
            memory_percent: 25,
        },
    } satisfies DockerContainer

    expect(containerCpuMetric(container).value).toBe('3.2%')
    expect(containerMemoryMetric(container).value).toBe('256.0 MB / 1.00 GB (25.0%)')
})

test('system dashboard freshness marks stale generated timestamps', () => {
    expect(isFresh(new Date().toISOString(), 30_000)).toBe(true)
    expect(isFresh('2020-01-01T00:00:00.000Z', 30_000)).toBe(false)
})
