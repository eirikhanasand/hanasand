'use client'

import Link from 'next/link'
import { CheckCircle2, Cookie, Database, KeyRound, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCookie, removeCookie, setCookie } from '@/utils/cookies/cookies'

type ConsentChoice = 'unset' | 'essential' | 'optional'

type StorageSnapshot = {
    consent: ConsentChoice
    consentUpdatedAt: string
    sessionToken: boolean
    roleToken: boolean
    impersonationToken: boolean
    localProductKeys: string[]
    sessionProductKeys: string[]
}

const consentCookie = 'hanasand_cookie_consent'
const consentUpdatedCookie = 'hanasand_cookie_consent_updated_at'
const hiddenCookieNames = new Set(['id', 'name', 'theme'])
const productStoragePrefixes = [
    'hanasand.share.',
    'hanasand.share.git.',
    'hanasand.ai.',
    'hanasand:dwm-',
    'hanasand:ti-',
    'hanasand:load-testing-',
    'hanasand:share-design-memory',
    'hanasand.upload.',
]

export default function CookieSettingsClient() {
    const [snapshot, setSnapshot] = useState<StorageSnapshot>(() => emptySnapshot())
    const [message, setMessage] = useState('Settings loaded.')

    useEffect(() => {
        setSnapshot(readSnapshot())
    }, [])

    const consentLabel = useMemo(() => {
        if (snapshot.consent === 'optional') return 'Optional cookies allowed'
        if (snapshot.consent === 'essential') return 'Essential cookies only'
        return 'No preference saved'
    }, [snapshot.consent])

    function saveConsent(choice: Exclude<ConsentChoice, 'unset'>) {
        const updatedAt = new Date().toISOString()
        setCookie(consentCookie, choice, 365)
        setCookie(consentUpdatedCookie, updatedAt, 365)
        setSnapshot(readSnapshot())
        setMessage(choice === 'optional' ? 'Optional cookie consent saved.' : 'Essential-only preference saved.')
    }

    function resetConsent() {
        removeCookie(consentCookie)
        removeCookie(consentUpdatedCookie)
        setSnapshot(readSnapshot())
        setMessage('Cookie consent choice reset for this browser.')
    }

    function clearProductStorage() {
        const cleared = clearKeys(snapshot.localProductKeys, window.localStorage)
            + clearKeys(snapshot.sessionProductKeys, window.sessionStorage)
        setSnapshot(readSnapshot())
        setMessage(cleared ? `Cleared ${cleared} local product token${cleared === 1 ? '' : 's'}.` : 'No local product tokens were present.')
    }

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] text-[#171a21]'>
            <section className='border-b border-[#e3e7ee] bg-white'>
                <div className='mx-auto grid max-w-5xl gap-4 px-4 py-14 md:px-8 md:py-18'>
                    <p className='text-sm font-semibold uppercase text-[#3056d3]'>Settings</p>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Cookie settings</h1>
                    <p className='max-w-3xl text-lg leading-8 text-[#596170]'>
                        Keep the required account cookies, tune optional consent, and clear browser-local Hanasand tokens when this device needs a fresh start.
                    </p>
                </div>
            </section>

            <section className='mx-auto grid max-w-5xl gap-4 px-4 py-10 md:px-8'>
                <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div className='flex items-center gap-3'>
                            <span className='grid h-10 w-10 place-items-center rounded-lg border border-[#d8e0ec] bg-[#f8fafc] text-[#3056d3]'>
                                <Cookie className='h-5 w-5' />
                            </span>
                            <div>
                                <p className='text-sm font-semibold text-[#171a21]'>{consentLabel}</p>
                                <p className='text-sm text-[#667085]'>{snapshot.consentUpdatedAt ? `Updated ${formatDate(snapshot.consentUpdatedAt)}` : 'This browser has not saved a consent choice yet.'}</p>
                            </div>
                        </div>
                        <p className='rounded-full border border-[#dfe5ee] bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-[#3d4758]'>{message}</p>
                    </div>
                </div>

                <div className='grid gap-4 lg:grid-cols-[1fr_0.8fr]'>
                    <section className='rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold'>Consent</h2>
                                <p className='mt-2 text-sm leading-7 text-[#596170]'>
                                    Required cookies keep login and protected routes working. Optional cookies are for product measurement and remembered notices when Hanasand enables them.
                                </p>
                            </div>
                            <ShieldCheck className='h-5 w-5 text-[#147a3b]' />
                        </div>

                        <div className='mt-5 grid gap-2 sm:grid-cols-3'>
                            <ConsentButton active={snapshot.consent === 'optional'} onClick={() => saveConsent('optional')} icon={<CheckCircle2 className='h-4 w-4' />} title='Allow optional' detail='Fine for product measurement.' />
                            <ConsentButton active={snapshot.consent === 'essential'} onClick={() => saveConsent('essential')} icon={<ShieldCheck className='h-4 w-4' />} title='Essential only' detail='Keep it lean.' />
                            <ConsentButton active={snapshot.consent === 'unset'} onClick={resetConsent} icon={<RefreshCcw className='h-4 w-4' />} title='Reset choice' detail='Ask again later.' />
                        </div>
                    </section>

                    <section className='rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold'>Account tokens</h2>
                                <p className='mt-2 text-sm leading-7 text-[#596170]'>
                                    Sign-in cookies are required for the console. Values are never shown here.
                                </p>
                            </div>
                            <KeyRound className='h-5 w-5 text-[#3056d3]' />
                        </div>
                        <div className='mt-4 grid gap-2'>
                            <StatusRow label='Session token' present={snapshot.sessionToken} />
                            <StatusRow label='Role token' present={snapshot.roleToken} />
                            <StatusRow label='Support session token' present={snapshot.impersonationToken} />
                        </div>
                        <Link
                            href='/logout'
                            className='mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-[#d0d7e2] bg-white px-3 text-sm font-semibold text-[#3d4758] shadow-sm transition hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'
                        >
                            <KeyRound className='h-4 w-4' />
                            Sign out to clear session
                        </Link>
                    </section>
                </div>

                <section className='rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold'>Browser-local product tokens</h2>
                            <p className='mt-2 max-w-3xl text-sm leading-7 text-[#596170]'>
                                These are local drafts and product state for share workspaces, DWM setup, recent uploads, load testing, TI cache, and AI workspace continuity. Clearing them does not change your account, username, roles, or theme.
                            </p>
                        </div>
                        <button
                            type='button'
                            onClick={clearProductStorage}
                            className='inline-flex h-10 items-center gap-2 rounded-md border border-[#f3b1a8] bg-[#fff8f6] px-3 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff1f0]'
                        >
                            <Trash2 className='h-4 w-4' />
                            Clear local tokens
                        </button>
                    </div>

                    <div className='mt-4 grid gap-3 md:grid-cols-2'>
                        <TokenList title='Local storage' keys={snapshot.localProductKeys} />
                        <TokenList title='Session storage' keys={snapshot.sessionProductKeys} />
                    </div>
                </section>

                <section className='rounded-lg border border-[#dfe5ee] bg-white p-5 text-sm leading-7 text-[#596170] shadow-sm'>
                    Browser controls can still delete every cookie and storage item for this site. Hanasand keeps username and visual theme controls in the account and header surfaces where users already expect them.
                </section>
            </section>
        </main>
    )
}

function ConsentButton({
    active,
    onClick,
    icon,
    title,
    detail,
}: {
    active: boolean
    onClick: () => void
    icon: ReactNode
    title: string
    detail: string
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`rounded-lg border p-3 text-left transition ${
                active
                    ? 'border-[#b8c5ff] bg-[#f4f7ff] text-[#243f99] shadow-sm'
                    : 'border-[#dfe5ee] bg-white text-[#3d4758] hover:border-[#c8d2df] hover:bg-[#f8fafc]'
            }`}
        >
            <span className='flex items-center gap-2 text-sm font-semibold'>{icon}{title}</span>
            <span className='mt-1 block text-xs text-[#667085]'>{detail}</span>
        </button>
    )
}

function StatusRow({ label, present }: { label: string, present: boolean }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-md border border-[#dfe5ee] bg-[#f8fafc] px-3 py-2 text-sm'>
            <span className='font-medium text-[#3d4758]'>{label}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${present ? 'bg-[#ecfdf3] text-[#067647]' : 'bg-white text-[#667085]'}`}>
                {present ? 'Present' : 'Not set'}
            </span>
        </div>
    )
}

function TokenList({ title, keys }: { title: string, keys: string[] }) {
    return (
        <div className='rounded-md border border-[#dfe5ee] bg-[#f8fafc] p-3'>
            <div className='flex items-center justify-between gap-3'>
                <h3 className='text-sm font-semibold text-[#171a21]'>{title}</h3>
                <span className='inline-flex items-center gap-1 rounded-full border border-[#dfe5ee] bg-white px-2.5 py-1 text-xs font-semibold text-[#3d4758]'>
                    <Database className='h-3.5 w-3.5' />
                    {keys.length}
                </span>
            </div>
            <div className='mt-3 flex flex-wrap gap-2'>
                {keys.length ? keys.map((key) => (
                    <span key={key} className='rounded-full border border-[#dfe5ee] bg-white px-2.5 py-1 text-xs font-medium text-[#596170]'>{friendlyKey(key)}</span>
                )) : (
                    <span className='text-sm text-[#667085]'>Nothing product-local stored here.</span>
                )}
            </div>
        </div>
    )
}

function readSnapshot(): StorageSnapshot {
    const cookies = cookieNames()
    return {
        consent: normalizeConsent(getCookie(consentCookie)),
        consentUpdatedAt: getCookie(consentUpdatedCookie) || '',
        sessionToken: cookies.includes('access_token'),
        roleToken: cookies.includes('roles'),
        impersonationToken: cookies.includes('impersonation_token'),
        localProductKeys: productKeys(window.localStorage),
        sessionProductKeys: productKeys(window.sessionStorage),
    }
}

function emptySnapshot(): StorageSnapshot {
    return {
        consent: 'unset',
        consentUpdatedAt: '',
        sessionToken: false,
        roleToken: false,
        impersonationToken: false,
        localProductKeys: [],
        sessionProductKeys: [],
    }
}

function normalizeConsent(value: string | null): ConsentChoice {
    if (value === 'essential' || value === 'optional') return value
    return 'unset'
}

function cookieNames() {
    return document.cookie
        .split(';')
        .map((item) => item.split('=')[0]?.trim())
        .filter((name): name is string => Boolean(name) && !hiddenCookieNames.has(name))
}

function productKeys(storage: Storage) {
    try {
        const keys: string[] = []
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index)
            if (key && productStoragePrefixes.some((prefix) => key.startsWith(prefix))) {
                keys.push(key)
            }
        }
        return keys.sort()
    } catch {
        return []
    }
}

function clearKeys(keys: string[], storage: Storage) {
    let cleared = 0
    for (const key of keys) {
        try {
            storage.removeItem(key)
            cleared += 1
        } catch {
            // Storage can be locked down by browser policy; keep clearing the rest.
        }
    }
    return cleared
}

function friendlyKey(key: string) {
    return key
        .replace(/^hanasand[.:]/, '')
        .replace(/\.v\d+(\.|$)/g, '$1')
        .replace(/[.:_-]+/g, ' ')
        .trim()
        .slice(0, 48)
}

function formatDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
}
