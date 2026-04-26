'use client'

import { useMemo, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { DashboardPanel } from '@/components/dashboard/ui'

export type RateLimitScope = 'anonymous' | 'authenticated' | 'internal'

export type RateLimitRule = {
    windowMs: number
    maxRequests: number
}

export type RateLimitOverride = {
    id: string
    enabled: boolean
    method: string
    route: string
    scope: RateLimitScope
    windowMs: number
    maxRequests: number
}

export type RateLimitSettings = {
    enabled: boolean
    defaults: Record<RateLimitScope, RateLimitRule>
    overrides: RateLimitOverride[]
    updatedAt: string | null
    updatedBy: string | null
}

export type RateLimitRoute = {
    method: string
    route: string
}

const scopeOrder: RateLimitScope[] = ['anonymous', 'authenticated', 'internal']

const fallbackSettings: RateLimitSettings = {
    enabled: true,
    defaults: {
        anonymous: {
            windowMs: 60_000,
            maxRequests: 90,
        },
        authenticated: {
            windowMs: 60_000,
            maxRequests: 1_800,
        },
        internal: {
            windowMs: 60_000,
            maxRequests: 6_000,
        },
    },
    overrides: [],
    updatedAt: null,
    updatedBy: null,
}

export default function RateLimitsPageClient({
    initialSettings,
    routes,
}: {
    initialSettings: RateLimitSettings | null
    routes: RateLimitRoute[]
}) {
    const [settings, setSettings] = useState<RateLimitSettings>(initialSettings || fallbackSettings)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const routeOptions = useMemo(
        () => routes.map((route) => `${route.method} ${route.route}`),
        [routes]
    )

    async function save() {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            setMessage('You need to sign in again before saving rate-limit settings.')
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

    return (
        <div className='grid gap-4'>
            <DashboardPanel className='p-4 sm:p-5'>
                <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                    <div className='max-w-3xl'>
                        <p className='text-sm text-bright/72'>
                            Every API endpoint is now covered by the same limiter. Anonymous traffic is kept tight, while signed-in and internal traffic gets much roomier defaults so normal dashboard and project work stays smooth.
                        </p>
                        <p className='mt-2 text-xs text-bright/42'>
                            Limits are enforced per API route and also against a broader per-actor bucket, which helps stop slug scanners from hopping across many unique paths.
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <label className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-bright/78'>
                            <input
                                type='checkbox'
                                checked={settings.enabled}
                                onChange={(event) => setSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
                                className='h-4 w-4 accent-[#fd8738]'
                            />
                            Enabled
                        </label>
                        <button
                            type='button'
                            onClick={save}
                            disabled={saving}
                            className='inline-flex items-center gap-2 rounded-xl border border-[#fd8738]/25 bg-[#fd8738]/10 px-3 py-2 text-sm text-[#ffd2b0] transition-colors hover:bg-[#fd8738]/14 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            <Save className='h-4 w-4' />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
                <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-bright/48'>
                    <span>Updated {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'never'}</span>
                    {settings.updatedBy ? <span>by `{settings.updatedBy}`</span> : null}
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
                            <div className='rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-bright/55'>
                                all API routes
                            </div>
                        </div>
                        <div className='mt-4 grid gap-3'>
                            <label className='grid gap-1.5 text-sm text-bright/68'>
                                <span>Window (ms)</span>
                                <input
                                    type='number'
                                    min={1000}
                                    value={settings.defaults[scope].windowMs}
                                    onChange={(event) => updateDefault(scope, 'windowMs', Number(event.target.value || 0))}
                                    className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
                                />
                            </label>
                            <label className='grid gap-1.5 text-sm text-bright/68'>
                                <span>Requests per window</span>
                                <input
                                    type='number'
                                    min={1}
                                    value={settings.defaults[scope].maxRequests}
                                    onChange={(event) => updateDefault(scope, 'maxRequests', Number(event.target.value || 0))}
                                    className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
                                />
                            </label>
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
                        className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-bright/76 transition-colors hover:bg-white/[0.08]'
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
                            <label className='grid gap-1.5 text-sm text-bright/68'>
                                <span>Route</span>
                                <input
                                    list='rate-limit-routes'
                                    value={`${override.method} ${override.route}`}
                                    onChange={(event) => {
                                        const [method, ...routeParts] = event.target.value.split(' ')
                                        updateOverride(override.id, 'method', (method || 'GET').toUpperCase())
                                        updateOverride(override.id, 'route', routeParts.join(' ') || '/api/')
                                    }}
                                    className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
                                />
                            </label>
                            <label className='grid gap-1.5 text-sm text-bright/68'>
                                <span>Scope</span>
                                <select
                                    value={override.scope}
                                    onChange={(event) => updateOverride(override.id, 'scope', event.target.value as RateLimitScope)}
                                    className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
                                >
                                    {scopeOrder.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
                                </select>
                            </label>
                            <label className='grid gap-1.5 text-sm text-bright/68'>
                                <span>Window (ms)</span>
                                <input
                                    type='number'
                                    min={1000}
                                    value={override.windowMs}
                                    onChange={(event) => updateOverride(override.id, 'windowMs', Number(event.target.value || 0))}
                                    className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
                                />
                            </label>
                            <label className='grid gap-1.5 text-sm text-bright/68'>
                                <span>Requests</span>
                                <input
                                    type='number'
                                    min={1}
                                    value={override.maxRequests}
                                    onChange={(event) => updateOverride(override.id, 'maxRequests', Number(event.target.value || 0))}
                                    className='rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-bright outline-none transition-colors focus:border-[#fd8738]/35'
                                />
                            </label>
                            <button
                                type='button'
                                onClick={() => removeOverride(override.id)}
                                className='inline-flex items-center justify-center rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-red-100 transition-colors hover:bg-red-500/14'
                            >
                                <Trash2 className='h-4 w-4' />
                            </button>
                        </div>
                    )) : (
                        <div className='rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-bright/52'>
                            No overrides yet. The defaults above already cover every API endpoint.
                        </div>
                    )}
                </div>
                <datalist id='rate-limit-routes'>
                    {routeOptions.map((option) => <option key={option} value={option} />)}
                </datalist>
            </DashboardPanel>
        </div>
    )
}
