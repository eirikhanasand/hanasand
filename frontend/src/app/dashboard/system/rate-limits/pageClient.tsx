'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Copy, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react'
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
        label: 'Operations',
        description: 'Trusted service automations and operations.',
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

type OwnerUserOption = {
    id: string
    name: string
    email?: string
    organization?: string
    organizationIds?: string
    role?: string
    active?: boolean
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
    const [ownerUsers, setOwnerUsers] = useState<OwnerUserOption[]>([])
    const [ownerUsersLoading, setOwnerUsersLoading] = useState(false)
    const [ownerUsersError, setOwnerUsersError] = useState<string | null>(null)
    const [workspace, setWorkspace] = useState<'keys' | 'policy'>('keys')
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
    const draftRequiredValidation = useMemo(
        () => validateKeyFields(draft),
        [draft]
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
    const draftReady = draftRequiredValidation.valid && draftScopeValidation.valid
    const draftReadiness = !draftRequiredValidation.valid
        ? draftRequiredValidation.message
        : !draftScopeValidation.valid
            ? draftScopeValidation.message
            : 'Ready to issue'

    const loadOwnerUsers = useCallback(async () => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setOwnerUsersError('Sign in again to search users.')
            return
        }

        setOwnerUsersLoading(true)
        setOwnerUsersError(null)
        try {
            const response = await fetch(`${config.url.api}/users`, {
                headers: {
                    Authorization: `Bearer ${decodeURIComponent(token)}`,
                    id,
                },
            })
            const payload = await response.json().catch(() => [])
            if (response.status === 404) {
                setOwnerUsers([])
                return
            }
            if (!response.ok) {
                throw new Error(payload?.error || 'Unable to load users.')
            }
            const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.users) ? payload.users : []
            setOwnerUsers((rows.map(normalizeOwnerUser).filter(Boolean) as OwnerUserOption[]).sort(sortOwnerUsers))
        } catch (error) {
            setOwnerUsers([])
            setOwnerUsersError(error instanceof Error ? error.message : 'Unable to load users.')
        } finally {
            setOwnerUsersLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadOwnerUsers()
    }, [loadOwnerUsers])

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

        if (!draftRequiredValidation.valid) {
            setKeyMessage(draftRequiredValidation.message)
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
                        <p className='text-[11px] uppercase tracking-[0.24em] text-ui-muted'>System</p>
                        <h1 className='mt-1 text-xl font-semibold text-ui-text'>Traffic policy and access keys</h1>
                        <p className='mt-2 text-sm leading-6 text-ui-muted'>
                            Control request pressure, route exceptions, and owner-linked integration keys from one console.
                        </p>
                        <p className='mt-2 text-xs leading-5 text-ui-muted'>
                            Saves take effect immediately for live traffic. Route rows below show what is protected and which keys can use it.
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
                    <div className='inline-flex rounded-lg border border-ui-border bg-ui-raised p-1' role='group' aria-label='Rate-limit workspace'>
                        {([
                            ['keys', 'Access keys'],
                            ['policy', 'Traffic policy'],
                        ] as const).map(([key, label]) => (
                            <button
                                key={key}
                                type='button'
                                onClick={() => setWorkspace(key)}
                                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                                    workspace === key ? 'bg-ui-primary/15 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {workspace === 'policy' ? (
                        <>
                            <label className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted'>
                                <input
                                    type='checkbox'
                                    checked={settings.enabled}
                                    onChange={(event) => setSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
                                    className='h-4 w-4 accent-ui-primary'
                                />
                                Enabled
                            </label>
                            <div className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs text-ui-muted'>
                                Global changes apply to new requests immediately.
                            </div>
                            <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
                                <label className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted'>
                                    <span className='text-xs text-ui-muted'>Updated</span>
                                    <span>{settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'never'}</span>
                                </label>
                                <button
                                    type='button'
                                    onClick={saveSettings}
                                    disabled={saving || !overrideValidation.valid}
                                    className='inline-flex items-center gap-2 rounded-lg border border-ui-primary/30 bg-ui-primary/10 px-3 py-2 text-sm text-ui-primary transition-colors hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    <Save className='h-4 w-4' />
                                    {saving ? 'Saving...' : 'Save policy'}
                                </button>
                            </div>
                        </>
                    ) : draft.ownerId || draft.name || draft.description || draft.expiresAt || draft.scopes.length ? (
                        <div className={`rounded-lg border px-3 py-2 text-sm sm:ml-auto ${draftReady ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'}`}>
                            {draftReadiness}
                        </div>
                    ) : null}
                </div>
                <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-ui-muted'>
                    {settings.updatedBy ? <span>saved by `{settings.updatedBy}`</span> : null}
                    {message ? <span className='text-ui-warning'>{message}</span> : null}
                </div>
            </DashboardPanel>

            {workspace === 'policy' ? (
                <>
                    <div className='grid gap-4 xl:grid-cols-3'>
                        {scopeOrder.map((scope) => (
                            <DashboardPanel key={scope} className='p-4 sm:p-5'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div>
                                        <p className='text-[11px] uppercase tracking-[0.24em] text-ui-muted'>{scope}</p>
                                        <h2 className='mt-1 text-base font-semibold text-ui-text'>Default policy</h2>
                                    </div>
                                    <div className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-[11px] text-ui-muted'>
                                        all routes
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
                                <p className='text-[11px] uppercase tracking-[0.24em] text-ui-muted'>Overrides</p>
                                <h2 className='mt-1 text-base font-semibold text-ui-text'>Per-endpoint tuning</h2>
                                <p className='mt-1 text-sm text-ui-muted'>
                                    Tighten or loosen specific routes without changing the global traffic policy.
                                </p>
                            </div>
                            <button
                                type='button'
                                onClick={addOverride}
                                className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted transition-colors hover:bg-ui-raised'
                            >
                                <Plus className='h-4 w-4' />
                                Add override
                            </button>
                        </div>

                        <div className='mt-4 grid gap-3'>
                            {settings.overrides.length ? settings.overrides.map((override) => (
                                <div key={override.id} className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 lg:grid-cols-[auto_minmax(0,1fr)_10rem_10rem_8rem_auto] lg:items-end'>
                                    <label className='inline-flex items-center gap-2 text-sm text-ui-muted'>
                                        <input
                                            type='checkbox'
                                            checked={override.enabled}
                                            onChange={(event) => updateOverride(override.id, 'enabled', event.target.checked)}
                                            className='h-4 w-4 accent-ui-primary'
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
                                <EmptyState message='No route exceptions. Global policy covers every route.' />
                            )}
                        </div>
                        {!overrideValidation.valid ? (
                            <div className='mt-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>
                                {overrideValidation.message}
                            </div>
                        ) : null}
                    </DashboardPanel>
                </>
            ) : null}

            {workspace === 'keys' ? (
                <DashboardPanel className='p-4 sm:p-5'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                        <div>
                            <p className='text-[11px] uppercase tracking-[0.24em] text-ui-muted'>Access keys</p>
                            <h2 className='mt-1 text-base font-semibold text-ui-text'>Tiered tokens</h2>
                            <p className='mt-1 text-sm text-ui-muted'>
                                Pick an owner, choose the routes this key can use, and set the budget for each scope.
                            </p>
                        </div>
                        {keyMessage ? <div className='text-sm text-ui-warning'>{keyMessage}</div> : null}
                    </div>

                    <div className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-4'>
                        <div className='grid gap-3 md:grid-cols-2 md:items-end xl:grid-cols-4'>
                            <OwnerUserPicker
                                label='Owner'
                                value={draft.ownerId}
                                users={ownerUsers}
                                loading={ownerUsersLoading}
                                error={ownerUsersError}
                                onChange={(value) => setDraft((prev) => ({ ...prev, ownerId: value }))}
                                onRefresh={loadOwnerUsers}
                            />
                            <TextField label='Key name' value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} />
                            <SelectField
                                label='Tier'
                                value={draft.tier}
                                options={tierPresetIds}
                                onChange={(value) => applyDraftTierPreset(value)}
                            />
                            <DateField label='Expires at' value={draft.expiresAt} onChange={(value) => setDraft((prev) => ({ ...prev, expiresAt: value }))} />
                        </div>
                        <div className='mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'>
                            <TextField label='Description' value={draft.description} onChange={(value) => setDraft((prev) => ({ ...prev, description: value }))} />
                            <label className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted'>
                                <input
                                    type='checkbox'
                                    checked={draft.enabled}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))}
                                    className='h-4 w-4 accent-ui-primary'
                                />
                                Enabled
                            </label>
                        </div>
                        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-ui-muted'>
                            <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 uppercase tracking-[0.18em] text-ui-muted'>Preset</span>
                            <span>{draftTierPreset.label}: {draftTierPreset.description}</span>
                            <span>New scopes inherit this tier. Changing it updates every draft scope.</span>
                        </div>

                        <div className='mt-4 flex items-center justify-between gap-3'>
                            <h3 className='text-sm font-medium text-ui-text'>Scoped endpoint limits</h3>
                            <button
                                type='button'
                                onClick={addScopeToDraft}
                                className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted transition-colors hover:bg-ui-raised'
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
                                <div className='rounded-lg border border-dashed border-ui-border bg-ui-raised px-4 py-5'>
                                    <p className='text-sm font-medium text-ui-text'>No endpoint scope yet.</p>
                                    <p className='mt-1 text-sm leading-6 text-ui-muted'>Add the first allowed route before issuing this key.</p>
                                    <button
                                        type='button'
                                        onClick={addScopeToDraft}
                                        className='mt-3 inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted transition-colors hover:bg-ui-raised'
                                    >
                                        <Plus className='h-4 w-4' />
                                        Add first scope
                                    </button>
                                </div>
                            )}
                        </div>
                        {draft.scopes.length && !draftScopeValidation.valid ? (
                            <div className='mt-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>
                                {draftScopeValidation.message}
                            </div>
                        ) : null}

                        <div className='mt-4 flex flex-wrap items-center gap-3'>
                            <button
                                type='button'
                                onClick={createKey}
                                disabled={saving || !draftReady}
                                className='inline-flex items-center gap-2 rounded-lg border border-ui-primary/30 bg-ui-primary/10 px-3 py-2 text-sm text-ui-primary transition-colors hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                <Save className='h-4 w-4' />
                                {saving ? 'Creating...' : 'Create Key'}
                            </button>
                            {issuedSecret ? (
                                <button
                                    type='button'
                                    onClick={() => navigator.clipboard.writeText(issuedSecret)}
                                    className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted transition-colors hover:bg-ui-raised'
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
                                ownerUsers={ownerUsers}
                                ownerUsersLoading={ownerUsersLoading}
                                ownerUsersError={ownerUsersError}
                                reloadOwnerUsers={loadOwnerUsers}
                                setApiKeys={setApiKeys}
                                applyKeyTierPreset={applyKeyTierPreset}
                                updateKey={updateKey}
                                deleteKey={deleteKey}
                                addScopeToKey={addScopeToKey}
                                removeKeyScope={removeKeyScope}
                            />
                        )) : (
                            <EmptyState message='No access keys issued yet.' />
                        )}
                    </div>
                </DashboardPanel>
            ) : null}

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
    ownerUsers,
    ownerUsersLoading,
    ownerUsersError,
    reloadOwnerUsers,
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
    ownerUsers: OwnerUserOption[]
    ownerUsersLoading: boolean
    ownerUsersError: string | null
    reloadOwnerUsers: () => Promise<void>
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
    const fieldValidation = useMemo(
        () => validateKeyFields({
            ownerId: apiKey.ownerId || '',
            name: apiKey.name,
            tier: apiKey.tier,
            description: apiKey.description || '',
            expiresAt: apiKey.expiresAt || '',
        }),
        [apiKey.description, apiKey.expiresAt, apiKey.name, apiKey.ownerId, apiKey.tier]
    )
    const tierPreset = tierPresetMap[apiKey.tier] || tierPresetMap.custom || fallbackTierPresets[fallbackTierPresets.length - 1]

    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='text-base font-semibold text-ui-text'>{apiKey.name}</h3>
                        <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-ui-muted'>
                            {tierPreset.label}
                        </span>
                        <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-[11px] text-ui-muted'>{apiKey.keyPrefix}</span>
                    </div>
                    <p className='mt-2 text-sm text-ui-muted'>{apiKey.description || 'No description set.'}</p>
                    <div className='mt-2 flex flex-wrap gap-3 text-xs text-ui-muted'>
                        <span>{apiKey.ownerId ? <>Creator `{apiKey.ownerId}`</> : 'Organization-owned'}</span>
                        <span>Created {new Date(apiKey.createdAt).toLocaleString()}</span>
                        <span>Last used {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : 'never'}</span>
                    </div>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    <label className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted'>
                        <input
                            type='checkbox'
                            checked={apiKey.enabled}
                            onChange={(event) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, enabled: event.target.checked } : entry))}
                            className='h-4 w-4 accent-ui-primary'
                        />
                        Enabled
                    </label>
                    <button
                        type='button'
                        onClick={() => updateKey(apiKey)}
                        disabled={saving || !fieldValidation.valid || !scopeValidation.valid}
                        className='inline-flex items-center gap-2 rounded-lg border border-ui-primary/30 bg-ui-primary/10 px-3 py-2 text-sm text-ui-primary transition-colors hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                        <Save className='h-4 w-4' />
                        Save key
                    </button>
                    <button
                        type='button'
                        onClick={() => deleteKey(apiKey.id)}
                        className='inline-flex items-center gap-2 rounded-lg border border-ui-danger/30 bg-ui-danger/10 px-3 py-2 text-sm text-ui-danger transition-colors hover:bg-ui-danger/15'
                    >
                        <Trash2 className='h-4 w-4' />
                        Delete
                    </button>
                </div>
            </div>

            <details className='mt-4 rounded-lg border border-ui-border bg-ui-panel'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text'>
                    <span>Key settings</span>
                    <span className='text-xs font-medium text-ui-muted'>{tierPreset.label} · {apiKey.expiresAt ? 'expires' : 'no expiry'}</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-4 md:grid-cols-2 xl:grid-cols-4'>
                    <TextField label='Name' value={apiKey.name} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, name: value } : entry))} />
                    <SelectField
                        label='Tier'
                        value={apiKey.tier}
                        options={tierPresetIds}
                        onChange={(value) => applyKeyTierPreset(apiKey.id, value)}
                    />
                    <OwnerUserPicker
                        label='Owner'
                        value={apiKey.ownerId || ''}
                        users={ownerUsers}
                        loading={ownerUsersLoading}
                        error={ownerUsersError}
                        onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, ownerId: value } : entry))}
                        onRefresh={reloadOwnerUsers}
                    />
                    <DateField label='Expires at' value={apiKey.expiresAt || ''} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, expiresAt: value || null } : entry))} />
                    <div className='md:col-span-2 xl:col-span-4'>
                        <TextField label='Description' value={apiKey.description || ''} onChange={(value) => setApiKeys((prev) => prev.map((entry) => entry.id === apiKey.id ? { ...entry, description: value || null } : entry))} />
                    </div>
                    <p className='text-xs leading-5 text-ui-muted md:col-span-2 xl:col-span-4'>
                        {tierPreset.description}
                    </p>
                </div>
            </details>

            <details className='mt-3 rounded-lg border border-ui-border bg-ui-panel'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text'>
                    <span>Endpoint scopes</span>
                    <span className='text-xs font-medium text-ui-muted'>{apiKey.scopes.length} route{apiKey.scopes.length === 1 ? '' : 's'}</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-4'>
                    <div className='flex justify-end'>
                        <button
                            type='button'
                            onClick={() => addScopeToKey(apiKey.id)}
                            className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted transition-colors hover:bg-ui-raised'
                        >
                            <Plus className='h-4 w-4' />
                            Add scope
                        </button>
                    </div>
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
                        <EmptyState message='Add a scope to set endpoint limits.' />
                    )}
                </div>
            </details>
            {!fieldValidation.valid || !scopeValidation.valid ? (
                <div className='mt-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>
                    {fieldValidation.valid ? scopeValidation.message : fieldValidation.message}
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

function validateKeyFields(input: Pick<DraftApiKey, 'ownerId' | 'name' | 'tier' | 'description' | 'expiresAt'>) {
    const missing = [
        [input.ownerId, 'Choose an owner'],
        [input.name, 'Name the key'],
        [input.tier, 'Choose a tier'],
        [input.expiresAt, 'Pick an expiry date'],
        [input.description, 'Add a description'],
    ].find(([value]) => !String(value).trim())

    return missing
        ? { valid: false, message: String(missing[1]) }
        : { valid: true, message: '' }
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
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='mb-3 flex items-center justify-between gap-3'>
                <p className='text-sm font-medium text-ui-text'>{title}</p>
                <RemoveButton onClick={onRemove} />
            </div>
            <div className='grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_repeat(4,minmax(0,1fr))] lg:items-end'>
                <label className='inline-flex items-center gap-2 text-sm text-ui-muted'>
                    <input
                        type='checkbox'
                        checked={scope.enabled}
                        onChange={(event) => onChange({ ...scope, enabled: event.target.checked })}
                        className='h-4 w-4 accent-ui-primary'
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
        <div className='rounded-lg border border-ui-border bg-ui-panel px-3 py-3'>
            <p className='text-[10px] uppercase tracking-[0.22em] text-ui-muted'>{label}</p>
            <p className='mt-1 text-base font-semibold text-ui-text'>{value}</p>
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
        <label className='grid gap-1.5 text-sm text-ui-muted'>
            <span>{label}</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition-colors focus:border-ui-primary/35'
            />
        </label>
    )
}

function DateField({
    label,
    value,
    onChange,
}: {
    label: string
    value: string
    onChange: (value: string) => void
}) {
    return (
        <label className='grid gap-1.5 text-sm text-ui-muted'>
            <span>{label}</span>
            <input
                type='date'
                value={isoToDateInput(value)}
                onChange={(event) => onChange(dateInputToIso(event.target.value))}
                className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition-colors focus:border-ui-primary/35'
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
        <label className='grid gap-1.5 text-sm text-ui-muted'>
            <span>{label}</span>
            <input
                type='number'
                min={min}
                value={value}
                onChange={(event) => onChange(Number(event.target.value || 0))}
                className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition-colors focus:border-ui-primary/35'
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
        <label className='grid gap-1.5 text-sm text-ui-muted'>
            <span>{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition-colors focus:border-ui-primary/35'
            >
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
        </label>
    )
}

function OwnerUserPicker({
    label,
    value,
    users,
    loading,
    error,
    onChange,
    onRefresh,
}: {
    label: string
    value: string
    users: OwnerUserOption[]
    loading: boolean
    error: string | null
    onChange: (value: string) => void
    onRefresh: () => Promise<void>
}) {
    const listId = useId()
    const rootRef = useRef<HTMLDivElement | null>(null)
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const selectedUser = users.find((user) => user.id === value.trim())
    const filteredUsers = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        if (!normalizedQuery) return users.slice(0, 8)
        return users.filter((user) => ownerUserSearchText(user).includes(normalizedQuery)).slice(0, 8)
    }, [query, users])

    useEffect(() => {
        if (open) return
        setQuery(selectedUser ? formatOwnerUser(selectedUser) : value)
    }, [open, selectedUser, value])

    return (
        <div
            ref={rootRef}
            className='relative grid gap-1.5 text-sm text-ui-muted'
            onBlur={(event) => {
                if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
                    setOpen(false)
                }
            }}
        >
            <span>{label}</span>
            <div className='relative'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />
                <input
                    role='combobox'
                    aria-label={label}
                    aria-controls={listId}
                    aria-expanded={open}
                    aria-autocomplete='list'
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(event) => {
                        setQuery(event.target.value)
                        setOpen(true)
                        onChange(event.target.value)
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') setOpen(false)
                    }}
                    placeholder='Search users or paste exact ID'
                    className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised pl-9 pr-3 text-sm text-ui-text outline-none transition-colors focus:border-ui-primary/35'
                />
            </div>
            {open ? (
                <div
                    id={listId}
                    role='listbox'
                    className='absolute left-0 right-0 top-[4.35rem] z-30 max-h-64 overflow-auto rounded-lg border border-ui-border bg-ui-panel p-1 shadow-2xl shadow-ui-canvas/30'
                >
                    {loading ? (
                        <div className='px-3 py-2 text-xs text-ui-muted'>Loading users...</div>
                    ) : error ? (
                        <div className='grid gap-2 px-3 py-2 text-xs text-ui-muted'>
                            <span>{error}</span>
                            <button
                                type='button'
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => void onRefresh()}
                                className='inline-flex w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-2.5 py-1.5 text-ui-muted transition-colors hover:bg-ui-raised'
                            >
                                <RefreshCw className='h-3.5 w-3.5' />
                                Retry
                            </button>
                        </div>
                    ) : filteredUsers.length ? (
                        filteredUsers.map((user) => (
                            <button
                                key={user.id}
                                type='button'
                                role='option'
                                aria-selected={user.id === value.trim()}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    onChange(user.id)
                                    setQuery(formatOwnerUser(user))
                                    setOpen(false)
                                }}
                                className='grid w-full gap-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-ui-raised aria-selected:bg-ui-primary/10'
                            >
                                <span className='text-sm text-ui-text'>{user.name || user.id}</span>
                                <span className='text-xs text-ui-muted'>{ownerUserMeta(user)}</span>
                            </button>
                        ))
                    ) : (
                        <div className='px-3 py-2 text-xs text-ui-muted'>No matching users. Paste an exact ID to use it.</div>
                    )}
                </div>
            ) : null}
        </div>
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
        <label className='grid gap-1.5 text-sm text-ui-muted'>
            <span>{label}</span>
            <input
                list='rate-limit-routes'
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={routeOptions[0] || 'GET /api/'}
                className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition-colors focus:border-ui-primary/35'
            />
        </label>
    )
}

function isoToDateInput(value: string) {
    return value && !Number.isNaN(Date.parse(value)) ? value.slice(0, 10) : ''
}

function dateInputToIso(value: string) {
    return value ? `${value}T23:59:59.999Z` : ''
}

function normalizeOwnerUser(value: unknown): OwnerUserOption | null {
    if (!value || typeof value !== 'object') return null
    const entry = value as Record<string, unknown>
    const id = stringValue(entry.id)
    if (!id) return null
    const name = stringValue(entry.name) || stringValue(entry.displayName) || stringValue(entry.display_name) || id
    return {
        id,
        name,
        email: stringValue(entry.email),
        organization: stringValue(entry.organization) || stringValue(entry.organizationName) || stringValue(entry.organization_name),
        organizationIds: stringValue(entry.organizationIds) || stringValue(entry.organization_ids),
        role: stringValue(entry.role) || stringValue(entry.highest_role_name) || stringValue(entry.highestRoleName),
        active: typeof entry.active === 'boolean' ? entry.active : undefined,
    }
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function formatOwnerUser(user: OwnerUserOption) {
    return [user.name, user.email || user.organization || user.id].filter(Boolean).join(' · ')
}

function ownerUserMeta(user: OwnerUserOption) {
    return [
        user.email,
        user.organization,
        user.organizationIds,
        user.role,
        user.active === false ? 'Inactive' : null,
        user.id,
    ].filter(Boolean).join(' · ')
}

function ownerUserSearchText(user: OwnerUserOption) {
    return [
        user.id,
        user.name,
        user.email,
        user.organization,
        user.organizationIds,
        user.role,
    ].filter(Boolean).join(' ').toLowerCase()
}

function sortOwnerUsers(first: OwnerUserOption, second: OwnerUserOption) {
    if (first.active === false && second.active !== false) return 1
    if (first.active !== false && second.active === false) return -1
    return (first.name || first.id).localeCompare(second.name || second.id)
}

function RemoveButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className='inline-flex items-center justify-center rounded-lg border border-ui-danger/30 bg-ui-danger/10 px-3 py-2 text-ui-danger transition-colors hover:bg-ui-danger/15'
        >
            <Trash2 className='h-4 w-4' />
        </button>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className='rounded-lg border border-dashed border-ui-border bg-ui-panel px-4 py-6 text-sm text-ui-muted'>
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
