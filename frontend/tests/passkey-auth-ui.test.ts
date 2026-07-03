import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import {
    decodePasskeyCreationOptions,
    decodePasskeyRequestOptions,
    passkeyCredentialToJSON,
} from '../src/utils/auth/passkeys'

const root = process.cwd()

test('passkey UI exposes enrollment and login actions', () => {
    const loginClient = readFileSync(join(root, 'src/app/login/pageClient.tsx'), 'utf8')
    const accountActions = readFileSync(join(root, 'src/components/profile/accountActions.tsx'), 'utf8')

    assert.match(loginClient, /Sign in with passkey/)
    assert.match(loginClient, /\/api\/auth\/passkeys\/authenticate\/options/)
    assert.match(loginClient, /\/api\/auth\/passkeys\/authenticate\/verify/)
    assert.match(accountActions, /Add passkey/)
    assert.match(accountActions, /No passkeys enrolled/)
    assert.match(accountActions, /Remove/)
    assert.match(accountActions, /\/api\/auth\/passkeys/)
    assert.match(accountActions, /\/api\/auth\/passkeys\/register\/options/)
    assert.match(accountActions, /\/api\/auth\/passkeys\/register\/verify/)
})

test('SSO login is wired through the frontend auth proxy', () => {
    const loginClient = readFileSync(join(root, 'src/app/login/pageClient.tsx'), 'utf8')
    const ssoStartRoute = readFileSync(join(root, 'src/app/api/auth/sso/start/route.ts'), 'utf8')
    const ssoCallbackRoute = readFileSync(join(root, 'src/app/api/auth/sso/callback/route.ts'), 'utf8')

    assert.match(loginClient, /Continue with SSO/)
    assert.match(loginClient, /\/api\/auth\/sso\/start\?redirectPath=/)
    assert.match(ssoStartRoute, /\/auth\/sso\/start/)
    assert.match(ssoStartRoute, /safeRedirectPath/)
    assert.match(ssoCallbackRoute, /\/auth\/sso\/callback/)
    assert.match(ssoCallbackRoute, /setAuthCookies/)
    assert.match(ssoCallbackRoute, /safeRedirectPath\(data\.redirectPath\)/)
})

test('passkey browser helpers translate WebAuthn binary fields', () => {
    const requestOptions = decodePasskeyRequestOptions({
        challenge: encode('request-challenge'),
        rpId: 'hanasand.com',
        allowCredentials: [{ type: 'public-key', id: encode('credential-id') }],
    })
    assert.equal(decode(requestOptions.challenge as ArrayBuffer), 'request-challenge')
    assert.equal(decode(requestOptions.allowCredentials?.[0]?.id as ArrayBuffer), 'credential-id')

    const creationOptions = decodePasskeyCreationOptions({
        challenge: encode('create-challenge'),
        rp: { id: 'hanasand.com', name: 'Hanasand' },
        user: { id: encode('user-id'), name: 'analyst', displayName: 'Analyst' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        excludeCredentials: [{ type: 'public-key', id: encode('existing-credential') }],
    })
    assert.equal(decode(creationOptions.challenge as ArrayBuffer), 'create-challenge')
    assert.equal(decode(creationOptions.user.id as ArrayBuffer), 'user-id')
    assert.equal(decode(creationOptions.excludeCredentials?.[0]?.id as ArrayBuffer), 'existing-credential')

    const credential = {
        id: 'credential-id',
        rawId: bytes('raw-id'),
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
            clientDataJSON: bytes('client-data'),
            authenticatorData: bytes('auth-data'),
            signature: bytes('signature'),
            userHandle: bytes('user-id'),
        },
    } as unknown as PublicKeyCredential
    assert.deepEqual(passkeyCredentialToJSON(credential), {
        id: 'credential-id',
        rawId: encode('raw-id'),
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
            clientDataJSON: encode('client-data'),
            authenticatorData: encode('auth-data'),
            signature: encode('signature'),
            userHandle: encode('user-id'),
        },
    })
})

function bytes(value: string) {
    return new TextEncoder().encode(value).buffer
}

function encode(value: string) {
    return Buffer.from(value, 'utf8').toString('base64url')
}

function decode(buffer: ArrayBuffer) {
    return new TextDecoder().decode(buffer)
}
