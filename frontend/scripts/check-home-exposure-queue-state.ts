import { mergeExposureQueueItems } from '../src/app/homeExposureQueueClient'

const persisted = [{
    id: 'cap_old_lockbit',
    actor: 'LockBit',
    company: 'Alpine Robotics',
    claimedData: 'Corporate data',
    claimedDataSize: '22 GB',
    claimTime: '2026-01-01T00:00:00.000Z',
    status: 'parsed',
}]

const preservedDuringChecking = mergeExposureQueueItems(persisted, [], 'replace')
assertEqual(preservedDuringChecking.length, 1, 'checking refresh must not hide persisted rows')
assertEqual(preservedDuringChecking[0]?.company, 'Alpine Robotics', 'checking refresh must keep the persisted row')

const updated = mergeExposureQueueItems(persisted, [{
    ...persisted[0],
    status: 'needs_review',
}], 'replace')
assertEqual(updated.length, 1, 'refresh should dedupe rows by id')
assertEqual(updated[0]?.status, 'needs_review', 'refresh data should update existing row fields')

const appended = mergeExposureQueueItems(persisted, [{
    id: 'cap_new_akira',
    actor: 'Akira',
    company: 'Fabrikam Manufacturing',
    claimedData: 'Corporate data',
    claimedDataSize: '44 GB',
    claimTime: '2026-07-02T10:00:00.000Z',
    status: 'new',
}], 'append')
assertEqual(appended.length, 2, 'pagination append should keep historical and new rows')

console.log('Home exposure queue state checks passed.')

function assertEqual(actual: unknown, expected: unknown, message: string) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`)
    }
}
