'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import { Copy, Plus, Save, Trash2 } from 'lucide-react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { DashboardPanel } from '@/components/dashboard/ui'

const scopeOrder: RateLimitScope[] = ['anonymous', 'authenticated', 'internal']
const periodFields: Array<{ key: keyof ApiKeyPeriodLimits, label: string }> = [
    { key: 'perSecond', label: 'Per second' },
    { key: 'perMinute', label: 'Per minute' },
    { key: 'perHour', label: 'Per hour' },
    { key: 'perDay', label: 'Per day' },
]
const fallbackTierPresets: ApiKeyTierDefinition[] = [
    {
        id: 'starter',
        label: 'Starter',
        description: 'Low-volume external integrations.',
        defaultLimits: { perSecond: 2, perMinute: 60, perHour: 1_000, perDay: 10_000 },
    },
    {
        id: 'growth',
        label: 'Growth',
        description: 'Steady third-party traffic with moderate burst room.',
        defaultLimits: { perSecond: 8, perMinute: 240, perHour: 6_000, perDay: 60_000 },
    },
    {
        id: 'business',
        label: 'Business',
        description: 'Higher-throughput production integrations.',
        defaultLimits: { perSecond: 20, perMinute: 600, perHour: 24_000, perDay: 250_000 },
    },
    {
        id: 'internal',
        label: 'Internal',
        description: 'Trusted internal automations and operations.',
        defaultLimits: { perSecond: 60, perMinute: 3_000, perHour: 120_000, perDay: 1_000_000 },
    },
    {
        id: 'custom',
        label: 'Custom',
        description: 'Manually tuned per-endpoint limits.',
        defaultLimits: { perSecond: 5, perMinute: 60, perHour: 1_000, perDay: 10_000 },
    },
]

const fallbackSettings: RateLimitSettings = {
    enabled: true,
    defaults: {
        anonymous: { windowMs: 60_000, maxRequests: 90 },
        authenticated: { windowMs: 60_000, maxRequests: 1_800 },
        internal: { windowMs: 60_000, maxRequests: 6_000 },
    },
    overrides: [],
    updatedAt: null,
    updatedBy: null,
}

type DraftApiKey = {
    ownerId: string
    name: string
    tier: string
    description: string
    enabled: boolean
    expiresAt: string
    scopes: ApiKeyScopeRule[]
}

const emptyDraft: DraftApiKey = {
    ownerId: '',
    name: '',
    tier: 'starter',
    description: '',
    enabled: true,
    expiresAt: '',
    scopes: [],
}

export default function RateLimitsPageClient({
    initialSettings,
    routes,
    tierPresets,
    initialApiKeys,
}: {
    initialSettings: RateLimitSettings | null
    routes: RateLimitRoute[]
    tierPresets: ApiKeyTierDefinition[]
    initialApiKeys: ApiKeySummary[]
}) {
    const [settings, setSettings] = useState<RateLimitSettings>(initialSettings || fallbackSettings)
    const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>(initialApiKeys)
    const [draft, setDraft] = useState<DraftApiKey>(emptyDraft)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [keyMessage, setKeyMessage] = useState<string | null>(null)
    const [issuedSecret, setIssuedSecret] = useState<string | null>(null)
    const activeTierPresets = tierPresets.length ? tierPresets : fallbackTierPresets
    const tierPresetIds = activeTierPresets.map((preset) => preset.id)
    const tierPresetMap = useMemo(
        () => Object.fromEntries(activeTierPresets.map((preset) => [preset.id, preset])),
        [activeTierPresets]
    )
    const draftTierPreset = tierPresetMap[draft.tier] || tierPresetMap.custom || fallbackTierPresets[fallbackTierPresets.length - 1]
    const draftScopeValidation = useMemo(
        () => validateScopeSet(draft.scopes),
        [draft.scopes]
    )

    const routeOptions = useMemo(
        () => routes.map((route) => `${route.method} ${route.route}`),
        [routes]
    )
    const overrideValidation = useMemo(
        () => validateOverrideSet(settings.overrides),
        [settings.overrides]
    )
    const routeCount = routes.length
    const overrideCount = settings.overrides.filter((override) => override.enabled).length

    async function saveSettings() {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setMessage('You need to sign in again before saving rate-limit settings.')
            return
        }

        if (!overrideValidation.valid) {
            setMessage(overrideValidation.message)
            return
        }

        setSaving(true)
        setMessage(null)
        try {
            const response = await fetch(`${config.url.api}/rate-limit/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${decodeURIComponent(token)}`,
                    id,
                },
                body: JSON.stringify(settings),
            })

            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to save rate-limit settings.')
            }

            setSettings(payload?.settings && typeof payload.settings === 'object' ? payload.settings as RateLimitSettings : settings)
            setMessage('Rate-limit settings saved.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to save rate-limit settings.')
        } finally {
            setSaving(false)
        }
    }

    async function createKey() {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setKeyMessage('You need to sign in again before issuing API keys.')
            return
        }

        if (!draft.ownerId.trim() || !draft.name.trim()) {
            setKeyMessage('Owner ID and key name are required.')
            return
        }

        if (!draftScopeValidation.valid) {
            setKeyMessage(draftScopeValidation.message)
            return
        }

        setSaving(true)
        setKeyMessage(null)
        setIssuedSecret(null)
        try {
            const response = await fetch(`${config.url.api}/rate-limit/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${decodeURIComponent(token)}`,
                    id,
                },
                body: JSON.stringify({
                    ownerId: draft.ownerId.trim(),
                    name: draft.name.trim(),
                    tier: draft.tier.trim() || 'custom',
                    description: draft.description.trim() || null,
                    enabled: draft.enabled,
                    expiresAt: draft.expiresAt || null,
                    scopes: draft.scopes,
                }),
            })

            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to create API key.')
            }

            if (payload?.apiKey) {
                setApiKeys((prev) => [payload.apiKey as ApiKeySummary, ...prev])
            }
            setIssuedSecret(typeof payload?.secret === 'string' ? payload.secret : null)
            setDraft(emptyDraft)
            setKeyMessage('API key issued.')
        } catch (error) {
            setKeyMessage(error instanceof Error ? error.message : 'Unable to create API key.')
        } finally {
            setSaving(false)
        }
    }

    async function updateKey(apiKey: ApiKeySummary) {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setKeyMessage('You need to sign in again before updating API keys.')
            return
        }

        const validation = validateScopeSet(apiKey.scopes)
        if (!validation.valid) {
            setKeyMessage(validation.message)
            return
        }

        setSaving(true)
        setKeyMessage(null)
        try {
            const response = await fetch(`${config.url.api}/rate-limit/keys/${apiKey.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${decodeURIComponent(token)}`,
                    id,
                },
                body: JSON.stringify(apiKey),
            })

            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to update API key.')
            }

            if (payload?.apiKey) {
                setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? payload.apiKey as ApiKeySummary : entry))
            }
            setKeyMessage('API key updated.')
        } catch (error) {
            setKeyMessage(error instanceof Error ? error.message : 'Unable to update API key.')
        } finally {
            setSaving(false)
        }
    }

    async function deleteKey(idToDelete: string) {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setKeyMessage('You need to sign in again before deleting API keys.')
            return
        }

        setSaving(true)
        setKeyMessage(null)
        try {
            const response = await fetch(`${config.url.api}/rate-limit/keys/${idToDelete}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${decodeURIComponent(token)}`,
                    id,
                },
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to delete API key.')
            }

            setApiKeys((prev) => prev.filter((entry) => entry.id !== idToDelete))
            setKeyMessage('API key deleted.')
        } catch (error) {
            setKeyMessage(error instanceof Error ? error.message : 'Unable to delete API key.')
        } finally {
            setSaving(false)
        }
    }

    function updateDefault(scope: RateLimitScope, field: keyof RateLimitRule, value: number) {
        setSettings((prev) => ({
            ...prev,
            defaults: {
                ...prev.defaults,
                [scope]: {
                    ...prev.defaults[scope],
                    [field]: value,
                },
            },
        }))
    }

    function updateOverride(id: string, field: keyof RateLimitOverride, value: string | number | boolean) {
        setSettings((prev) => ({
            ...prev,
            overrides: prev.overrides.map((override) => override.id === id ? { ...override, [field]: value } : override),
        }))
    }

    function addOverride() {
        const firstRoute = routes[0]
        setSettings((prev) => ({
            ...prev,
            overrides: [
                ...prev.overrides,
                {
                    id: crypto.randomUUID(),
                    enabled: true,
                    method: firstRoute?.method || 'GET',
                    route: firstRoute?.route || '/api/',
                    scope: 'anonymous',
                    windowMs: prev.defaults.anonymous.windowMs,
                    maxRequests: prev.defaults.anonymous.maxRequests,
                },
            ],
        }))
    }

    function removeOverride(id: string) {
        setSettings((prev) => ({
            ...prev,
            overrides: prev.overrides.filter((override) => override.id !== id),
        }))
    }

    function addScopeToDraft() {
        const firstRoute = routes[0]
        const limits = createPresetLimits(draft.tier, tierPresetMap)
        setDraft((prev) => ({
            ...prev,
            scopes: [
                ...prev.scopes,
                {
                    id: crypto.randomUUID(),
                    enabled: true,
                    method: firstRoute?.method || 'GET',
                    route: firstRoute?.route || '/api/',
                    limits,
                },
            ],
        }))
    }

    function addScopeToKey(keyId: string) {
        const firstRoute = routes[0]
        setApiKeys((prev) => prev.map((entry) => entry.id === keyId ? {
            ...entry,
            scopes: [
                ...entry.scopes,
                {
                    id: crypto.randomUUID(),
                    enabled: true,
                    method: firstRoute?.method || 'GET',
                    route: firstRoute?.route || '/api/',
                    limits: createPresetLimits(entry.tier, tierPresetMap),
                },
            ],
        } : entry))
    }

    function removeDraftScope(scopeId: string) {
        setDraft((prev) => ({
            ...prev,
            scopes: prev.scopes.filter((scope) => scope.id !== scopeId),
        }))
    }

    function removeKeyScope(keyId: string, scopeId: string) {
        setApiKeys((prev) => prev.map((entry) => entry.id === keyId ? {
            ...entry,
            scopes: entry.scopes.filter((scope) => scope.id !== scopeId),
        } : entry))
    }

    function applyDraftTierPreset(tier: string) {
        setDraft((prev) => ({
            ...prev,
            tier,
            scopes: prev.scopes.map((scope) => ({
                ...scope,
                limits: createPresetLimits(tier, tierPresetMap),
            })),
        }))
    }

    function applyKeyTierPreset(keyId: string, tier: string) {
        setApiKeys((prev) => prev.map((entry) => entry.id === keyId ? {
            ...entry,
            tier,
            scopes: entry.scopes.map((scope) => ({
                ...scope,
                limits: createPresetLimits(tier, tierPresetMap),
            })),
        } : entry))
    }

    return (
        <div className='grid gap-4'>
            <DashboardPanel className='p-4 sm:p-5'>
                <div className='grid gap-4 2xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:items-start'>
                    <div className='max-w-3xl'>
                        <p className='text-[11px] uppercase tracking-[0.24em] text-bright/35'>System</p>
                        <h1 className='mt-1 text-xl font-semibold tracking-[-0.04em] text-bright/94'>Rate limits and API keys</h1>
                        <p className='mt-2 text-sm leading-6 text-bright/72'>
                            Global API pressure, route overrides, and scoped tiered tokens now live in the same surface. Each token can be narrowed to exact endpoints and tuned independently per second, minute, hour, and day.
                        </p>
                        <p className='mt-2 text-xs leading-5 text-bright/42'>
                            Enforcement happens in the Hanasand API process itself, not via nginx or Lua. Saving here updates the shared settings store and the in-process cache, so behavior changes without a proxy reload.
                        </p>
                    </div>
                    <div className='grid gap-2 sm:grid-cols-2'>
                        <StatChip label='Routes' value={String(routeCount)} />
                        <StatChip label='Active overrides' value={String(overrideCount)} />
                        <StatChip label='Issued keys' value={String(apiKeys.length)} />
                        <StatChip label='Runtime' value={settings.enabled ? 'Enforced' : 'Paused'} />
                    </div>
                </div>
                <div className='mt-4 flex flex-wrap items-center gap-2'>
                    <label className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/78'>
                        <input
                            type='checkbox'
                            checked={settings.enabled}
                            onChange={(event) => setSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
                            className='h-4 w-4 accent-[#fd8738]'
                        />
                        Enabled
                    </label>
                    <div className='rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-bright/55'>
                        Global updates are immediate in-process and fall through the shared settings store on the next refresh window.
                    </div>
                    <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
                        <label className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/78'>
                            <span className='text-xs text-bright/52'>Updated</span>
                            <span>{settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'never'}</span>
                        </label>
                        <button
                            type='button'
                            onClick={saveSettings}
                            disabled={saving || !overrideValidation.valid}
                            className='inline-flex items-center gap-2 rounded-xl border border-[#fd8738]/25 bg-[#fd8738]/10 px-3 py-2 text-sm text-[#ffd2b0] transition-colors hover:bg-[#fd8738]/14 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            <Save className='h-4 w-4' />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
                <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-bright/48'>
                    {settings.updatedBy ? <span>saved by `{settings.updatedBy}`</span> : null}
                    {message ? <span className='text-[#fdc89c]'>{message}</span> : null}
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-3'>
                {scopeOrder.map((scope) => (
                    <DashboardPanel key={scope} className='p-4 sm:p-5'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <p className='text-[11px] uppercase tracking-[0.24em] text-bright/35'>{scope}</p>
                                <h2 className='mt-1 text-base font-semibold text-bright/90'>Default policy</h2>
                            </div>
                            <div className='rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-bright/55'>
                                all API routes
                            </div>
                        </div>
                        <div className='mt-4 grid gap-3'>
                            <NumberField
                                label='Window (ms)'
                                value={settings.defaults[scope].windowMs}
                                min={1000}
                                onChange={(value) => updateDefault(scope, 'windowMs', value)}
                            />
                            <NumberField
                                label='Requests per window'
                                value={settings.defaults[scope].maxRequests}
                                min={1}
                                onChange={(value) => updateDefault(scope, 'maxRequests', value)}
                            />
                        </div>
                    </DashboardPanel>
                ))}
            </div>

            <DashboardPanel className='p-4 sm:p-5'>
                <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                    <div>
                        <p className='text-[11px] uppercase tracking-[0.24em] text-bright/35'>Overrides</p>
                        <h2 className='mt-1 text-base font-semibold text-bright/90'>Per-endpoint tuning</h2>
                        <p className='mt-1 text-sm text-bright/60'>
                            Tighten or loosen specific routes without changing the defaults for the rest of the API.
                        </p>
                    </div>
                    <button
                        type='button'
                        onClick={addOverride}
                        className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/76 transition-colors hover:bg-white/8'
                    >
                        <Plus className='h-4 w-4' />
                        Add override
                    </button>
                </div>

                <div className='mt-4 grid gap-3'>
                    {settings.overrides.length ? settings.overrides.map((override) => (
                        <div key={override.id} className='grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 lg:grid-cols-[auto_minmax(0,1fr)_10rem_10rem_8rem_auto] lg:items-end'>
                            <label className='inline-flex items-center gap-2 text-sm text-bright/70'>
                                <input
                                    type='checkbox'
                                    checked={override.enabled}
                                    onChange={(event) => updateOverride(override.id, 'enabled', event.target.checked)}
                                    className='h-4 w-4 accent-[#fd8738]'
                                />
                                Enabled
                            </label>
                            <RouteChooser
                                label='Route'
                                routeOptions={routeOptions}
                                value={`${override.method} ${override.route}`}
                                onChange={(value) => {
                                    const [method, ...routeParts] = value.split(' ')
                                    updateOverride(override.id, 'method', (method || 'GET').toUpperCase())
                                    updateOverride(override.id, 'route', routeParts.join(' ') || '/api/')
                                }}
                            />
                            <SelectField
                                label='Scope'
                                value={override.scope}
                                options={scopeOrder}
                                onChange={(value) => updateOverride(override.id, 'scope', value as RateLimitScope)}
                            />
                            <NumberField
                                label='Window (ms)'
                                value={override.windowMs}
                                min={1000}
                                onChange={(value) => updateOverride(override.id, 'windowMs', value)}
                            />
                            <NumberField
                                label='Requests'
                                value={override.maxRequests}
                                min={1}
                                onChange={(value) => updateOverride(override.id, 'maxRequests', value)}
                            />
                            <RemoveButton onClick={() => removeOverride(override.id)} />
                        </div>
                    )) : (
                        <EmptyState message='No overrides yet. The defaults above already cover every API endpoint.' />
                    )}
                </div>
                {!overrideValidation.valid ? (
                    <div className='mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-100'>
                        {overrideValidation.message}
                    </div>
                ) : null}
            </DashboardPanel>

            <DashboardPanel className='p-4 sm:p-5'>
                <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                    <div>
                        <p className='text-[11px] uppercase tracking-[0.24em] text-bright/35'>API Keys</p>
                        <h2 className='mt-1 text-base font-semibold text-bright/90'>Tiered tokens</h2>
                        <p className='mt-1 text-sm text-bright/60'>
                            Issue owner-linked keys, scope them to exact endpoints, and give each scope independent second, minute, hour, and day budgets.
                        </p>
                    </div>
                    {keyMessage ? <div className='text-sm text-[#fdc89c]'>{keyMessage}</div> : null}
                </div>

                <div className='mt-4 rounded-2xl border border-white/10 bg-black/15 p-4'>
                    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                        <TextField label='Owner user ID' value={draft.ownerId} onChange={(value) => setDraft((prev) => ({ ...prev, ownerId: value }))} />
                        <TextField label='Key name' value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} />
                        <SelectField
                            label='Tier'
                            value={draft.tier}
                            options={tierPresetIds}
                            onChange={(value) => applyDraftTierPreset(value)}
                        />
                        <TextField label='Expires at (ISO)' value={draft.expiresAt} onChange={(value) => setDraft((prev) => ({ ...prev, expiresAt: value }))} />
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'>
                        <TextField label='Description' value={draft.description} onChange={(value) => setDraft((prev) => ({ ...prev, description: value }))} />
                        <label className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/78'>
                            <input
                                type='checkbox'
                                checked={draft.enabled}
                                onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))}
                                className='h-4 w-4 accent-[#fd8738]'
                            />
                            Enabled
                        </label>
                    </div>
                    <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-bright/54'>
                        <span className='rounded-full border border-white/10 bg-white/5 px-2.5 py-1 uppercase tracking-[0.18em] text-bright/48'>Preset</span>
                        <span>{draftTierPreset.label}: {draftTierPreset.description}</span>
                        <span>New scopes inherit the selected tier, and changing tier reapplies that preset across the draft key.</span>
                    </div>

                    <div className='mt-4 flex items-center justify-between gap-3'>
                        <h3 className='text-sm font-medium text-bright/84'>Scoped endpoint limits</h3>
                        <button
                            type='button'
                            onClick={addScopeToDraft}
                            className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/76 transition-colors hover:bg-white/8'
                        >
                            <Plus className='h-4 w-4' />
                            Add scope
                        </button>
                    </div>
                    <div className='mt-3 grid gap-3'>
                        {draft.scopes.length ? draft.scopes.map((scope, index) => (
                            <ApiKeyScopeEditor
                                key={scope.id}
                                scope={scope}
                                routeOptions={routeOptions}
                                title={`Draft scope ${index + 1}`}
                                onChange={(nextScope) => setDraft((prev) => ({
                                    ...prev,
                                    scopes: prev.scopes.map((entry) => entry.id === nextScope.id ? nextScope : entry),
                                }))}
                                onRemove={() => removeDraftScope(scope.id)}
                            />
                        )) : (
                            <EmptyState message='No key scopes yet. Add at least one scoped route before issuing the token.' />
                        )}
                    </div>
                    {!draftScopeValidation.valid ? (
                        <div className='mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-100'>
                            {draftScopeValidation.message}
                        </div>
                    ) : null}

                    <div className='mt-4 flex flex-wrap items-center gap-3'>
                        <button
                            type='button'
                            onClick={createKey}
                            disabled={saving || !draftScopeValidation.valid}
                            className='inline-flex items-center gap-2 rounded-xl border border-[#fd8738]/25 bg-[#fd8738]/10 px-3 py-2 text-sm text-[#ffd2b0] transition-colors hover:bg-[#fd8738]/14 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            <Save className='h-4 w-4' />
                            {saving ? 'Issuing...' : 'Issue API key'}
                        </button>
                        {issuedSecret ? (
                            <button
                                type='button'
                                onClick={() => navigator.clipboard.writeText(issuedSecret)}
                                className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/78 transition-colors hover:bg-white/8'
                            >
                                <Copy className='h-4 w-4' />
                                Copy `{issuedSecret}`
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className='mt-4 grid gap-4'>
                    {apiKeys.length ? apiKeys.map((apiKey) => (
                        <ApiKeyCard
                            key={apiKey.id}
                            apiKey={apiKey}
                            tierPresetMap={tierPresetMap}
                            fallbackTierPresets={fallbackTierPresets}
                            routeOptions={routeOptions}
                            tierPresetIds={tierPresetIds}
                            saving={saving}
                            setApiKeys={setApiKeys}
                            applyKeyTierPreset={applyKeyTierPreset}
                            updateKey={updateKey}
                            deleteKey={deleteKey}
                            addScopeToKey={addScopeToKey}
                            removeKeyScope={removeKeyScope}
                        />
                    )) : (
                        <EmptyState message='No API keys issued yet.' />
                    )}
                </div>
            </DashboardPanel>

            <datalist id='rate-limit-routes'>
                {routeOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
        </div>
    )
}

function ApiKeyCard({
    apiKey,
    tierPresetMap,
    fallbackTierPresets,
    routeOptions,
    tierPresetIds,
    saving,
    setApiKeys,
    applyKeyTierPreset,
    updateKey,
    deleteKey,
    addScopeToKey,
    removeKeyScope,
}: {
    apiKey: ApiKeySummary
    tierPresetMap: Record<string, ApiKeyTierDefinition>
    fallbackTierPresets: ApiKeyTierDefinition[]
    routeOptions: string[]
    tierPresetIds: string[]
    saving: boolean
    setApiKeys: Dispatch<SetStateAction<ApiKeySummary[]>>
    applyKeyTierPreset: (keyId: string, tier: string) => void
    updateKey: (apiKey: ApiKeySummary) => Promise<void>
    deleteKey: (idToDelete: string) => Promise<void>
    addScopeToKey: (keyId: string) => void
    removeKeyScope: (keyId: string, scopeId: string) => void
}) {
    const scopeValidation = useMemo(
        () => validateScopeSet(apiKey.scopes),
        [apiKey.scopes]
    )
    const tierPreset = tierPresetMap[apiKey.tier] || tierPresetMap.custom || fallbackTierPresets[fallbackTierPresets.length - 1]

    return (
        <div className='rounded-2xl border border-white/10 bg-black/15 p-4'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='text-base font-semibold text-bright/90'>{apiKey.name}</h3>
                        <span className='rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-bright/50'>
                            {tierPreset.label}
                        </span>
                        <span className='rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-bright/50'>{apiKey.keyPrefix}</span>
                    </div>
                    <p className='mt-2 text-sm text-bright/60'>{apiKey.description || 'No description provided.'}</p>
                    <div className='mt-2 flex flex-wrap gap-3 text-xs text-bright/45'>
                        <span>Owner `{apiKey.ownerId}`</span>
                        <span>Created {new Date(apiKey.createdAt).toLocaleString()}</span>
                        <span>Last used {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : 'never'}</span>
                    </div>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    <label className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/78'>
                        <input
                            type='checkbox'
                            checked={apiKey.enabled}
                            onChange={(event) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, enabled: event.target.checked } : entry))}
                            className='h-4 w-4 accent-[#fd8738]'
                        />
                        Enabled
                    </label>
                    <button
                        type='button'
                        onClick={() => updateKey(apiKey)}
                        disabled={saving || !scopeValidation.valid}
                        className='inline-flex items-center gap-2 rounded-xl border border-[#fd8738]/25 bg-[#fd8738]/10 px-3 py-2 text-sm text-[#ffd2b0] transition-colors hover:bg-[#fd8738]/14 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                        <Save className='h-4 w-4' />
                        Save key
                    </button>
                    <button
                        type='button'
                        onClick={() => deleteKey(apiKey.id)}
                        className='inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-100 transition-colors hover:bg-red-500/14'
                    >
                        <Trash2 className='h-4 w-4' />
                        Delete
                    </button>
                </div>
            </div>

            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <TextField label='Name' value={apiKey.name} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, name: value } : entry))} />
                <SelectField
                    label='Tier'
                    value={apiKey.tier}
                    options={tierPresetIds}
                    onChange={(value) => applyKeyTierPreset(apiKey.id, value)}
                />
                <TextField label='Owner user ID' value={apiKey.ownerId} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, ownerId: value } : entry))} />
                <TextField label='Expires at (ISO)' value={apiKey.expiresAt || ''} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, expiresAt: value || null } : entry))} />
            </div>
            <div className='mt-3'>
                <TextField label='Description' value={apiKey.description || ''} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, description: value || null } : entry))} />
            </div>
            <div className='mt-3 text-xs text-bright/54'>
                {tierPreset.description} Changing the tier reapplies the preset budget to every scope on this key. You can still fine-tune any endpoint budget afterwards.
            </div>

            <div className='mt-4 flex items-center justify-between gap-3'>
                <h4 className='text-sm font-medium text-bright/84'>Scopes</h4>
                <button
                    type='button'
                    onClick={() => addScopeToKey(apiKey.id)}
                    className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-bright/76 transition-colors hover:bg-white/8'
                >
                    <Plus className='h-4 w-4' />
                    Add scope
                </button>
            </div>
            <div className='mt-3 grid gap-3'>
                {apiKey.scopes.length ? apiKey.scopes.map((scope, index) => (
                    <ApiKeyScopeEditor
                        key={scope.id}
                        scope={scope}
                        routeOptions={routeOptions}
                        title={`Scope ${index + 1}`}
                        onChange={(nextScope) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? {
                            ...entry,
                            scopes: entry.scopes.map((currentScope) => currentScope.id === nextScope.id ? nextScope : currentScope),
                        } : entry))}
                        onRemove={() => removeKeyScope(apiKey.id, scope.id)}
                    />
                )) : (
                    <EmptyState message='This key has no endpoint scopes yet.' />
                )}
            </div>
            {!scopeValidation.valid ? (
                <div className='mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-100'>
                    {scopeValidation.message}
                </div>
            ) : null}
        </div>
    )
}

function validateScopeSet(scopes: ApiKeyScopeRule[]) {
    if (!scopes.length) {
        return {
            valid: false,
            message: 'Add at least one scoped endpoint before issuing or saving this token.',
        }
    }

    const seen = new Set<string>()
    for (const scope of scopes) {
        const key = `${scope.method}:${scope.route}`
        if (seen.has(key)) {
            return {
                valid: false,
                message: `Duplicate scope detected for ${scope.method} ${scope.route}. Remove or change one of them before saving.`,
            }
        }
        seen.add(key)
    }

    return {
        valid: true,
        message: '',
    }
}

function validateOverrideSet(overrides: RateLimitOverride[]) {
    const seen = new Set<string>()
    for (const override of overrides) {
        if (!override.route.startsWith('/api')) {
            return {
                valid: false,
                message: `Override routes must stay under /api. Fix ${override.method} ${override.route} before saving.`,
            }
        }

        const key = `${override.scope}:${override.method}:${override.route}`
        if (seen.has(key)) {
            return {
                valid: false,
                message: `Duplicate override detected for ${override.scope} ${override.method} ${override.route}. Remove or change one of them before saving.`,
            }
        }
        seen.add(key)
    }

    return {
        valid: true,
        message: '',
    }
}

function ApiKeyScopeEditor({
    scope,
    routeOptions,
    title,
    onChange,
    onRemove,
}: {
    scope: ApiKeyScopeRule
    routeOptions: string[]
    title: string
    onChange: (scope: ApiKeyScopeRule) => void
    onRemove: () => void
}) {
    return (
        <div className='rounded-2xl border border-white/10 bg-black/20 p-3'>
            <div className='mb-3 flex items-center justify-between gap-3'>
                <p className='text-sm font-medium text-bright/80'>{title}</p>
                <RemoveButton onClick={onRemove} />
            </div>
            <div className='grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_repeat(4,minmax(0,1fr))] lg:items-end'>
                <label className='inline-flex items-center gap-2 text-sm text-bright/70'>
                    <input
                        type='checkbox'
                        checked={scope.enabled}
                        onChange={(event) => onChange({ ...scope, enabled: event.target.checked })}
                        className='h-4 w-4 accent-[#fd8738]'
                    />
                    Enabled
                </label>
                <RouteChooser
                    label='Route'
                    routeOptions={routeOptions}
                    value={`${scope.method} ${scope.route}`}
                    onChange={(value) => {
                        const [method, ...routeParts] = value.split(' ')
                        onChange({
                            ...scope,
                            method: (method || 'GET').toUpperCase(),
                            route: routeParts.join(' ') || '/api/',
                        })
                    }}
                />
                {periodFields.map((period) => (
                    <NumberField
                        key={period.key}
                        label={period.label}
                        value={scope.limits[period.key] || 0}
                        min={0}
                        onChange={(value) => onChange({
                            ...scope,
                            limits: {
                                ...scope.limits,
                                [period.key]: value > 0 ? value : null,
                            },
                        })}
                    />
                ))}
            </div>
        </div>
    )
}

function StatChip({
    label,
    value,
}: {
    label: string
    value: string
}) {
    return (
        <div className='rounded-2xl border border-white/10 bg-black/15 px-3 py-3'>
            <p className='text-[10px] uppercase tracking-[0.22em] text-bright/38'>{label}</p>
            <p className='mt-1 text-base font-semibold text-bright/88'>{value}</p>
        </div>
    )
}

function TextField({
    label,
    value,
    onChange,
}: {
    label: string
    value: string
    onChange: (value: string) => void
}) {
    return (
        <label className='grid gap-1.5 text-sm text-bright/68'>
            <span>{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
            />
        </label>
    )
}

function NumberField({
    label,
    value,
    min,
    onChange,
}: {
    label: string
    value: number
    min: number
    onChange: (value: number) => void
}) {
    return (
        <label className='grid gap-1.5 text-sm text-bright/68'>
            <span>{label}</span>
            <input
                type='number'
                min={min}
                value={value}
                onChange={(event) => onChange(Number(event.target.value || 0))}
                className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
            />
        </label>
    )
}

function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: string
    options: string[]
    onChange: (value: string) => void
}) {
    return (
        <label className='grid gap-1.5 text-sm text-bright/68'>
            <span>{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
            >
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
        </label>
    )
}

function RouteChooser({
    label,
    routeOptions,
    value,
    onChange,
}: {
    label: string
    routeOptions: string[]
    value: string
    onChange: (value: string) => void
}) {
    return (
        <label className='grid gap-1.5 text-sm text-bright/68'>
            <span>{label}</span>
            <input
                list='rate-limit-routes'
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={routeOptions[0] || 'GET /api/'}
                className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
            />
        </label>
    )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className='inline-flex items-center justify-center rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-red-100 transition-colors hover:bg-red-500/14'
        >
            <Trash2 className='h-4 w-4' />
        </button>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className='rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-bright/52'>
            {message}
        </div>
    )
}

function createPresetLimits(
    tier: string,
    tierPresetMap: Record<string, ApiKeyTierDefinition>
): ApiKeyPeriodLimits {
    const preset = tierPresetMap[tier] || tierPresetMap.custom || fallbackTierPresets[fallbackTierPresets.length - 1]
    return {
        perSecond: preset.defaultLimits.perSecond,
        perMinute: preset.defaultLimits.perMinute,
        perHour: preset.defaultLimits.perHour,
        perDay: preset.defaultLimits.perDay,
    }
}
