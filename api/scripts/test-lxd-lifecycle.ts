import assert from 'node:assert/strict'
import {
    setLocalLxdInstanceState,
    setLxdRequestForTest,
    setVmDetailsWriterForTest,
} from '../src/utils/vms/lxd.ts'

const calls: Array<{ path: string, method: string }> = []
const operationLists = [
    {
        running: [{
            id: 'create-one',
            description: 'Creating instance',
            resources: { instances: ['/1.0/instances/busy-vm'] },
        }],
    },
    {},
    {
        running: [{
            id: 'create-two',
            description: 'Cloning original snapshot',
            resources: { instances: ['/1.0/instances/busy-vm'] },
        }],
    },
    {},
]
let stateTransitionAttempts = 0
let writes = 0

const restoreRequest = setLxdRequestForTest(async <T>(path: string, options = {}) => {
    const method = options.method || 'GET'
    calls.push({ path, method })

    if (path === '/1.0/instances/busy-vm') {
        return response({
            name: 'busy-vm',
            status: 'Stopped',
            type: 'container',
            config: {},
        }) as T
    }

    if (path === '/1.0/operations?recursion=1') {
        return response(operationLists.shift() || {}) as T
    }

    if (path === '/1.0/instances/busy-vm/state' && method === 'PUT') {
        stateTransitionAttempts += 1
        if (stateTransitionAttempts === 1) {
            throw new Error('Failed to create instance start operation: Instance is busy running a "create" operation')
        }

        return {
            status_code: 100,
            status: 'Operation created',
            metadata: {},
            operation: '/1.0/operations/start-one',
        } as T
    }

    if (path === '/1.0/instances/busy-vm/state') {
        return response({ status: 'Running', network: {} }) as T
    }

    if (path.startsWith('/1.0/operations/') && path.includes('/wait')) {
        return response({}) as T
    }

    throw new Error(`Unexpected LXD request in test: ${method} ${path}`)
})
const restoreWriter = setVmDetailsWriterForTest(async () => {
    writes += 1
})

try {
    await setLocalLxdInstanceState('busy-vm', 'start')

    assert.equal(stateTransitionAttempts, 2, 'start should be retried after the transient create-busy error')
    assert.equal(writes, 1, 'VM details should still be refreshed once after start succeeds')
    assert.deepEqual(
        calls
            .filter(call => call.path.includes('/operations/') && call.path.includes('/wait'))
            .map(call => call.path),
        [
            '/1.0/operations/create-one/wait?timeout=120',
            '/1.0/operations/create-two/wait?timeout=120',
            '/1.0/operations/start-one/wait?timeout=90',
        ],
        'create/clone operations should be drained before retrying start'
    )

    console.log('LXD lifecycle busy-create regression passed.')
} finally {
    restoreRequest()
    restoreWriter()
}

function response<T>(metadata: T) {
    return {
        status_code: 200,
        status: 'Success',
        metadata,
    }
}
