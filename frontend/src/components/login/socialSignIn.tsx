'use client'

import { useEffect, useState } from 'react'

type Provider = 'google' | 'apple'
type Connection = { provider: Provider, email: string | null }
const names = { google: 'Google', apple: 'Apple' }
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel focus:outline-none focus:ring-4 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'

export default function SocialSignIn({ link = false, redirectPath = '/dashboard' }: { link?: boolean, redirectPath?: string }) {
    const [providers, setProviders] = useState<{ provider: Provider, configured: boolean }[]>([])
    const [connections, setConnections] = useState<Connection[]>([])
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [busy, setBusy] = useState(false)
    useEffect(() => {
        let active = true
        async function load() {
            try {
                const response = await fetch('/api/auth/social/providers', { cache: 'no-store' })
                if (!response.ok) throw new Error('Unable to load Google and Apple sign-in.')
                const data = await response.json()
                if (active) setProviders(data.providers)
                if (link) {
                    const response = await fetch('/api/auth/social/connections', { cache: 'no-store' })
                    if (!response.ok) throw new Error('Unable to load connected accounts.')
                    const data = await response.json()
                    if (active) setConnections(data.connections)
                    if (new URLSearchParams(window.location.search).get('social') === 'linked' && active) setNotice('Account connected. You can now use it to sign in.')
                }
            } catch (error) { if (active) setError(error instanceof Error ? error.message : 'Unable to load sign-in options.') }
        }
        void load()
        return () => { active = false }
    }, [link])
    return <div className={link ? 'mt-4 border-t border-ui-border pt-4' : ''}>
        {link && <><h3 className='text-sm font-semibold text-ui-text'>Connected sign-in accounts</h3><p className='mb-3 mt-1 text-xs text-ui-muted'>Connect Google or Apple to sign in to this account with the same permissions.</p></>}
        <div className='grid gap-2 sm:grid-cols-2'>
            {(['google', 'apple'] as const).map(provider => {
                const ready = providers.find(item => item.provider === provider)?.configured
                const connected = connections.find(item => item.provider === provider)
                const label = `${link ? 'Connect' : 'Continue with'} ${names[provider]}`
                return <div key={provider} className='grid gap-1'>
                    {link ? <form method='post' action={`/api/auth/social/${provider}/start`} onSubmit={() => setBusy(true)}><button className={`${buttonClass} w-full`} disabled={busy || !ready || Boolean(connected)}>{connected ? `${names[provider]} connected` : label}</button></form>
                        : ready ? <a className={buttonClass} href={`/api/auth/social/${provider}/start?redirectPath=${encodeURIComponent(redirectPath)}`}>{label}</a>
                            : <button className={buttonClass} disabled>{label}</button>}
                    {connected && <p className='break-all text-xs text-ui-muted'>{connected.email || 'Connected'}</p>}
                    {!ready && providers.length > 0 && <p className='text-xs text-ui-muted'>Awaiting provider setup</p>}
                </div>
            })}
        </div>
        {error && <p role='alert' className='mt-2 text-sm text-ui-danger'>{error}</p>}
        {notice && <p role='status' className='mt-2 text-sm text-ui-text'>{notice}</p>}
    </div>
}
