import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { enrich } from './backfill-installed-versions.ts'
import { collectStatus, createPlan, failedRefreshStatus, packageBatch } from './apt-update-helper.ts'

test('backfill uses only installations in the recorded update window', () => {
    const events = [
        { run_id: 'one', occurred_at: '2026-09-16T23:10:10+00:00', installed: [{ package: 'sqlite' }, { package: 'unknown' }] },
        { run_id: 'two', occurred_at: '2026-09-17T00:00:00+00:00', installed: [] },
    ]
    const at = new Date('2026-09-16T23:10:25+00:00').toLocaleString('sv-SE').replace('T', ' ')
    const later = new Date('2026-09-17T01:00:00+00:00').toLocaleString('sv-SE').replace('T', ' ')
    expect(enrich(events, [
        `${at} status installed sqlite:amd64 3.1`,
        `${later} status installed sqlite:amd64 4`,
    ])).toEqual([{ run_id: 'one', installed: [{ package: 'sqlite', version: '3.1' }, { package: 'unknown' }] }])
    expect(enrich(events, [
        `${at} status installed sqlite:amd64 3.1`,
        `${at} status installed sqlite:amd64 4`,
    ])).toEqual([])
})

test('plans preserve first-seen time and install only verified, eligible Ubuntu updates', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hanasand-apt-plan-'))
    try {
        const track = join(directory, 'packages.tsv')
        const simulation = join(directory, 'simulation.txt')
        const plan = join(directory, 'plan.json')
        writeFileSync(track, 'openssl\t3.0\t100\tsecurity\tUbuntu\n')
        writeFileSync(simulation, [
            'Inst openssl [2.9] (3.0 Ubuntu:24.04/noble-security [amd64])',
            'Inst sqlite [1] (2 Ubuntu:24.04/noble-updates [amd64])',
            'Inst third-party [1] (2 Example:24.04/noble-security [amd64])',
        ].join('\n'))
        createPlan(track, simulation, plan, 1000, () => 0)
        const data = JSON.parse(readFileSync(plan, 'utf8'))
        expect(data.updates).toEqual([
            { package: 'openssl', version: '3.0', repo: 'Ubuntu:24.04/noble-security', origin: 'Ubuntu', security: true, first_seen: 100, installed_at: 0 },
            { package: 'sqlite', version: '2', repo: 'Ubuntu:24.04/noble-updates', origin: 'Ubuntu', security: false, first_seen: 1000, installed_at: 0 },
            { package: 'third-party', version: '2', repo: 'Example:24.04/noble-security', origin: 'Example', security: false, first_seen: 1000, installed_at: 0 },
        ])
        expect(packageBatch(plan, 72 * 60 * 60, 'security')).toBe('openssl')
        expect(packageBatch(plan, 72 * 60 * 60, 'regular')).toBe('sqlite')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('status retains pending packages and only reports installed versions verified by dpkg', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hanasand-apt-status-'))
    try {
        const output = join(directory, 'status.json')
        const plan = join(directory, 'plan.json')
        writeFileSync(plan, JSON.stringify({ updates: [
            { package: 'sqlite', version: '3.1', first_seen: 1 },
            { package: 'pending', version: '2', first_seen: 1 },
        ] }))
        collectStatus(output, plan, '{}', '2026-09-17T00:00:00Z', 'run', '', '', update => update.package === 'sqlite')
        const status = JSON.parse(readFileSync(output, 'utf8'))
        expect(status.status).toBe('pending')
        expect(status.installed_packages).toEqual([{ package: 'sqlite', version: '3.1' }])
        expect(status.pending_updates).toEqual([{ package: 'pending', version: '2', first_seen: 1 }])

        failedRefreshStatus(output, JSON.stringify(status), '2026-09-18T00:00:00Z', 'failed-run')
        const failed = JSON.parse(readFileSync(output, 'utf8'))
        expect(failed.status).toBe('failed')
        expect(failed.installed_packages).toEqual([])
        expect(failed.pending_updates).toEqual([{ package: 'pending', version: '2', first_seen: 1 }])
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
