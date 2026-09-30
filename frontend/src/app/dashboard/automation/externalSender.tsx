'use client'

import { useState } from 'react'
import { createSenderKey } from '@/utils/automations/client'

export default function ExternalSender({ id }: { id: string }) {
    const [credential, setCredential] = useState<{ secret: string, endpoint: string } | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    async function create() {
        setBusy(true)
        setError('')
        setCredential(null)
        try { setCredential(await createSenderKey(id)) }
        catch (error) { setError(error instanceof Error ? error.message : 'Unable to create a sender key.') }
        finally { setBusy(false) }
    }
    return <section aria-label='External sender' className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
        <label className='grid gap-1 text-sm text-ui-text'>Event API path<input readOnly value={`/api/automations/${id}/events`} className='w-full rounded border border-ui-border bg-ui-bg p-2 font-mono text-xs' /></label>
        <button type='button' disabled={busy} onClick={() => void create()} className='w-fit rounded border border-ui-border px-3 py-2 text-sm text-ui-text disabled:opacity-50'>{busy ? 'Creating key…' : 'Create or replace sender key'}</button>
        <p className='text-xs text-ui-muted'>Replacing the key disconnects the previous sender. Send this key in X-API-Key.</p>
        {credential && <div className='grid gap-1'><label className='grid gap-1 text-sm text-ui-text'>Sender key<input readOnly autoComplete='off' value={credential.secret} className='w-full rounded border border-ui-border bg-ui-bg p-2 font-mono text-xs' /></label><p className='text-xs text-ui-muted'>Save it now. It is shown only here.</p></div>}
        {error && <p role='alert' className='text-sm text-ui-text'>{error}</p>}
    </section>
}
