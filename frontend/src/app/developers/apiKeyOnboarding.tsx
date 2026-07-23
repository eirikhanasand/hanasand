'use client'

import Link from 'next/link'
import { Building2, CheckCircle2, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import CopyCodeButton from './copyCodeButton'

type Organization = { id: string, name: string, role?: string }
type ApiKey = {
    id: string
    organizationId: string | null
    name: string
    keyPrefix: string
    enabled: boolean
    expiresAt: string | null
    lastUsedAt: string | null
    scopes: Array<{ method: string, route: string }>
}

export default function ApiKeyOnboarding({ server }: { server: string }) {
    const [state, setState] = useState<'loading' | 'signed-out' | 'ready' | 'error'>('loading')
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [organizationId, setOrganizationId] = useState('')
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
    const [secret, setSecret] = useState('')
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [confirmRevoke, setConfirmRevoke] = useState('')

    useEffect(() => { void loadOrganizations() }, [])

    async function loadOrganizations() {
        setState('loading')
        try {
            const response = await fetch('/api/backend/organizations', { cache: 'no-store' })
            if (response.status === 401) return setState('signed-out')
            const payload = await responseJson<{ organizations?: Organization[] }>(response)
            const next = (payload.organizations ?? []).filter(organization => organization.role === 'owner' || organization.role === 'admin')
            setOrganizations(next)
            setState('ready')
            if (next[0]) {
                setOrganizationId(next[0].id)
                await loadApiKeys(next[0].id)
            }
        } catch (error) {
            setMessage(errorMessage(error))
            setState('error')
        }
    }

    async function loadApiKeys(id: string) {
        const response = await fetch(`/api/backend/organizations/${encodeURIComponent(id)}/api-keys`, { cache: 'no-store' })
        const payload = await responseJson<{ apiKeys?: ApiKey[] }>(response)
        setApiKeys(payload.apiKeys ?? [])
    }

    async function selectOrganization(id: string) {
        setOrganizationId(id)
        setSecret('')
        setMessage('')
        setConfirmRevoke('')
        setBusy('load')
        try {
            await loadApiKeys(id)
        } catch (error) {
            setMessage(errorMessage(error))
        } finally {
            setBusy('')
        }
    }

    async function createOrganization(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const element = event.currentTarget
        const form = new FormData(element)
        const name = String(form.get('organizationName') || '').trim()
        if (name.length < 2) return setMessage('Enter an organization name.')
        setBusy('organization')
        setMessage('')
        try {
            const response = await fetch('/api/organizations', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name }),
            })
            const payload = await responseJson<{ organization?: Organization }>(response)
            if (!payload.organization) throw new Error('Organization creation did not return an organization.')
            setOrganizations([payload.organization])
            setOrganizationId(payload.organization.id)
            setApiKeys([])
            element.reset()
            setMessage('Organization created. Create its API key next.')
        } catch (error) {
            setMessage(errorMessage(error))
        } finally {
            setBusy('')
        }
    }

    async function createApiKey(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const element = event.currentTarget
        const form = new FormData(element)
        const name = String(form.get('keyName') || '').trim()
        setBusy('key')
        setMessage('')
        try {
            const response = await fetch(`/api/backend/organizations/${encodeURIComponent(organizationId)}/api-keys`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name }),
            })
            const payload = await responseJson<{ apiKey: ApiKey, secret: string }>(response)
            setSecret(payload.secret)
            await loadApiKeys(organizationId)
            element.reset()
            setMessage('API key created. Copy the secret now; it is not stored in retrievable form.')
        } catch (error) {
            setMessage(errorMessage(error))
        } finally {
            setBusy('')
        }
    }

    async function revokeApiKey(keyId: string) {
        if (confirmRevoke !== keyId) return setConfirmRevoke(keyId)
        setBusy(keyId)
        setMessage('')
        try {
            const response = await fetch(`/api/backend/organizations/${encodeURIComponent(organizationId)}/api-keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' })
            await responseJson(response)
            setSecret('')
            setConfirmRevoke('')
            await loadApiKeys(organizationId)
            setMessage('API key revoked. Calls using it now return invalid_api_key.')
        } catch (error) {
            setMessage(errorMessage(error))
        } finally {
            setBusy('')
        }
    }

    const selected = organizations.find(organization => organization.id === organizationId)
    const activeKey = apiKeys.find(apiKey => apiKey.enabled)
    const firstRequest = `curl "${server}/actors?limit=20" \\\n  -H "X-API-Key: ${secret || '$HANASAND_API_KEY'}"`

    return (
        <section id='api-access' className='scroll-mt-24 border-b border-ui-border bg-ui-canvas'>
            <div className='mx-auto grid max-w-7xl gap-6 px-4 py-10 md:px-8'>
                <div className='max-w-3xl'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Customer onboarding</p>
                    <h2 className='mt-2 text-3xl font-semibold'>Organization, API key, first request.</h2>
                    <p className='mt-3 text-sm leading-7 text-ui-muted'>Keys are bound to one organization, use fixed read-only v1 scopes, expire after 90 days, and reveal the secret only once. Tenant-scoped alerts cannot be switched with request headers.</p>
                </div>

                {state === 'loading' ? <StateLine icon={<LoaderCircle className='h-4 w-4 animate-spin' />} text='Checking your signed-in organizations.' /> : null}
                {state === 'signed-out' ? (
                    <div className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 md:grid-cols-[1fr_auto] md:items-center'>
                        <div><h3 className='font-semibold'>Sign in to create a real key</h3><p className='mt-1 text-sm leading-6 text-ui-muted'>New accounts continue back here, create an organization, and can issue the first key without a sales ticket.</p></div>
                        <div className='flex flex-wrap gap-2'>
                            <Link href='/register?path=%2Fdevelopers%23api-access' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas'>Create account<Plus className='h-4 w-4' /></Link>
                            <Link href='/login?path=%2Fdevelopers%23api-access' className='inline-flex h-10 items-center rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold'>Log in</Link>
                        </div>
                    </div>
                ) : null}
                {state === 'error' ? <StateLine icon={<ShieldCheck className='h-4 w-4 text-ui-danger' />} text={message || 'API access onboarding is temporarily unavailable.'} /> : null}

                {state === 'ready' ? (
                    <div className='grid gap-4 lg:grid-cols-3'>
                        <article className='rounded-lg border border-ui-border bg-ui-panel p-5'>
                            <div className='flex items-center gap-2'><Building2 className='h-5 w-5 text-ui-primary' /><h3 className='font-semibold'>1. Organization</h3></div>
                            {organizations.length ? (
                                <label className='mt-4 grid gap-2 text-sm font-semibold'>Organization
                                    <select value={organizationId} onChange={event => void selectOrganization(event.target.value)} disabled={busy === 'load'} className='h-11 rounded-lg border border-ui-border bg-ui-canvas px-3 font-normal'>
                                        {organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                                    </select>
                                    <span className='text-xs font-normal text-ui-muted'>{selected?.role ? `${selected.role} access` : 'Signed-in member'}</span>
                                </label>
                            ) : (
                                <form className='mt-4 grid gap-3' onSubmit={createOrganization}>
                                    <label className='grid gap-2 text-sm font-semibold'>Organization name<input name='organizationName' minLength={2} maxLength={120} required className='h-11 rounded-lg border border-ui-border bg-ui-canvas px-3 font-normal' placeholder='Example Security Team' /></label>
                                    <button disabled={busy === 'organization'} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas disabled:opacity-60'>{busy === 'organization' ? 'Creating' : 'Create organization'}<Plus className='h-4 w-4' /></button>
                                </form>
                            )}
                        </article>

                        <article className='rounded-lg border border-ui-border bg-ui-panel p-5'>
                            <div className='flex items-center gap-2'><KeyRound className='h-5 w-5 text-ui-primary' /><h3 className='font-semibold'>2. API key</h3></div>
                            {!selected ? <p className='mt-4 text-sm leading-6 text-ui-muted'>Create an organization first.</p> : activeKey ? (
                                <div className='mt-4 grid gap-3 text-sm'>
                                    <div className='rounded-lg border border-ui-border bg-ui-canvas p-3'>
                                        <p className='font-semibold'>{activeKey.name}</p>
                                        <p className='mt-1 font-mono text-xs text-ui-muted'>hsk_{activeKey.keyPrefix}_…</p>
                                        <p className='mt-2 text-xs text-ui-muted'>{activeKey.scopes.length} read scopes · expires {formatDate(activeKey.expiresAt)} · last used {formatDate(activeKey.lastUsedAt)}</p>
                                    </div>
                                    <button type='button' onClick={() => void revokeApiKey(activeKey.id)} disabled={busy === activeKey.id} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-danger/40 px-3 font-semibold text-ui-danger disabled:opacity-60'><Trash2 className='h-4 w-4' />{confirmRevoke === activeKey.id ? 'Confirm revoke' : 'Revoke key'}</button>
                                </div>
                            ) : (
                                <form className='mt-4 grid gap-3' onSubmit={createApiKey}>
                                    <label className='grid gap-2 text-sm font-semibold'>Key name<input name='keyName' minLength={2} maxLength={80} required className='h-11 rounded-lg border border-ui-border bg-ui-canvas px-3 font-normal' defaultValue='Developer API' /></label>
                                    <button disabled={busy === 'key'} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas disabled:opacity-60'>{busy === 'key' ? 'Creating' : 'Create API key'}<KeyRound className='h-4 w-4' /></button>
                                </form>
                            )}
                        </article>

                        <article className='rounded-lg border border-ui-border bg-ui-panel p-5'>
                            <div className='flex items-center gap-2'><CheckCircle2 className='h-5 w-5 text-ui-primary' /><h3 className='font-semibold'>3. First request</h3></div>
                            {secret ? (
                                <div className='mt-4 grid gap-3'>
                                    <div className='rounded-lg border border-ui-warning/40 bg-ui-warning/10 p-3'><p className='text-xs font-semibold uppercase text-ui-warning'>Copy once</p><p className='mt-2 break-all font-mono text-xs text-ui-text'>{secret}</p><div className='mt-3'><CopyCodeButton value={secret} label='Copy key' /></div></div>
                                    <FirstRequest code={firstRequest} />
                                </div>
                            ) : <div className='mt-4 grid gap-3'><p className='text-sm leading-6 text-ui-muted'>Create a key to receive the real secret and a ready-to-run request. Existing secrets cannot be displayed again.</p><FirstRequest code={firstRequest} /></div>}
                        </article>
                    </div>
                ) : null}

                {state === 'ready' && message ? <StateLine icon={<CheckCircle2 className='h-4 w-4 text-ui-primary' />} text={message} /> : null}
            </div>
        </section>
    )
}

function FirstRequest({ code }: { code: string }) {
    return <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-text'><div className='flex items-center justify-between gap-2 border-b border-ui-border/40 px-3 py-2 text-xs font-semibold text-ui-canvas'><span>Run from your terminal</span><CopyCodeButton value={code} /></div><pre className='overflow-x-auto whitespace-pre-wrap p-3 text-xs leading-6 text-ui-canvas/85'>{code}</pre></div>
}

function StateLine({ icon, text }: { icon: ReactNode, text: string }) {
    return <div className='flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 py-3 text-sm text-ui-muted'>{icon}<span>{text}</span></div>
}

async function responseJson<T = Record<string, unknown>>(response: Response): Promise<T> {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new Error(apiError(payload, response.status))
    return payload as T
}

function apiError(payload: Record<string, unknown>, status: number) {
    const error = payload.error
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') return String((error as Record<string, unknown>).message)
    return `Request failed with HTTP ${status}.`
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

function formatDate(value: string | null) {
    if (!value) return 'never'
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp) : 'unknown'
}
