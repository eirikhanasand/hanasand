import crypto from 'node:crypto'
import { normalizeDwmWebhookDestinationInput, signDwmWebhookDeliveryBody } from '#utils/dwm/webhooks.ts'

const endpoint = 'https://receiver.example/dwm'
const body = '{"event":"alert"}'
const timestamp = '2026-08-08T08:00:00.000Z'
const secret = 'receiver-signing-secret'
const normalized = normalizeDwmWebhookDestinationInput({ endpointUrl: endpoint }, 'owner_signing_contract')

if (!normalized.signingSecret || normalized.signingSecret.length < 32) throw new Error('Webhook normalization must generate a per-destination signing secret.')
if (normalized.endpointEncrypted?.includes(endpoint)) throw new Error('Encrypted webhook target must not contain the plaintext endpoint.')

const expected = `sha256=${crypto.createHmac('sha256', secret).update(`${endpoint}\n${timestamp}\n${body}`).digest('hex')}`
if (signDwmWebhookDeliveryBody(body, endpoint, secret, timestamp) !== expected) throw new Error('Webhook signature must bind the endpoint, timestamp, and exact body.')
if (signDwmWebhookDeliveryBody(body, endpoint, secret, '2026-08-08T08:00:01.000Z') === expected) throw new Error('Webhook signature must change when the timestamp changes.')

console.log('DWM webhook signing contract passed.')
