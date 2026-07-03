export type PasskeyOptionsEnvelope = {
    challengeId: string
    publicKey: Record<string, any>
}

export function decodePasskeyRequestOptions(publicKey: Record<string, any>): PublicKeyCredentialRequestOptions {
    return {
        ...publicKey,
        challenge: base64urlToArrayBuffer(String(publicKey.challenge || '')),
        allowCredentials: Array.isArray(publicKey.allowCredentials)
            ? publicKey.allowCredentials.map((credential: Record<string, any>) => ({
                ...credential,
                id: base64urlToArrayBuffer(String(credential.id || '')),
            }))
            : [],
    } as PublicKeyCredentialRequestOptions
}

export function decodePasskeyCreationOptions(publicKey: Record<string, any>): PublicKeyCredentialCreationOptions {
    return {
        ...publicKey,
        challenge: base64urlToArrayBuffer(String(publicKey.challenge || '')),
        user: {
            ...publicKey.user,
            id: base64urlToArrayBuffer(String(publicKey.user?.id || '')),
        },
        excludeCredentials: Array.isArray(publicKey.excludeCredentials)
            ? publicKey.excludeCredentials.map((credential: Record<string, any>) => ({
                ...credential,
                id: base64urlToArrayBuffer(String(credential.id || '')),
            }))
            : [],
    } as PublicKeyCredentialCreationOptions
}

export function passkeyCredentialToJSON(credential: PublicKeyCredential) {
    const response = credential.response as AuthenticatorAssertionResponse & Partial<AuthenticatorAttestationResponse>
    const payload: Record<string, unknown> = {
        id: credential.id,
        rawId: arrayBufferToBase64url(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment,
        response: {
            clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
        },
    }

    if ('authenticatorData' in response && response.authenticatorData) {
        payload.response = {
            ...payload.response as Record<string, unknown>,
            authenticatorData: arrayBufferToBase64url(response.authenticatorData),
            signature: arrayBufferToBase64url(response.signature),
            userHandle: response.userHandle ? arrayBufferToBase64url(response.userHandle) : null,
        }
    }
    if ('attestationObject' in response && response.attestationObject) {
        payload.response = {
            ...payload.response as Record<string, unknown>,
            attestationObject: arrayBufferToBase64url(response.attestationObject),
        }
    }

    return payload
}

function base64urlToArrayBuffer(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index)
    }
    return bytes.buffer
}

function arrayBufferToBase64url(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) {
        binary += String.fromCharCode(byte)
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
