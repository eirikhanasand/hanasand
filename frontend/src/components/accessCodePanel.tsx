'use client'

import { useRef, type FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'

export default function AccessCodePanel({ code, onChange, busy, onSubmit }: {
    code: string, onChange: (code: string) => void, busy: boolean, onSubmit: (event: FormEvent<HTMLFormElement>) => void,
}) {
    const codeInputRef = useRef<HTMLInputElement>(null)
    const codeDigits = code.padEnd(6, ' ').split('')
    return (
        <form onSubmit={onSubmit} className='mx-auto mt-16 grid w-full max-w-md gap-5 rounded-lg border border-ui-border bg-ui-panel p-6 shadow-ui-panel'>
            <label className='grid gap-2 text-sm font-semibold'>
                Access code
                <input
                    ref={codeInputRef}
                    aria-label='Access code'
                    value={code}
                    onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode='numeric'
                    autoComplete='one-time-code'
                    className='sr-only'
                    placeholder='000000'
                />
                <button type='button' onClick={() => codeInputRef.current?.focus()} aria-label='Enter access code' className='grid grid-cols-6 gap-2'>
                    {codeDigits.map((digit, index) => (
                        <span key={index} className={`flex aspect-square items-center justify-center rounded-lg border bg-ui-canvas text-2xl font-semibold tabular-nums ${digit.trim() ? 'border-ui-primary/50 text-ui-text' : 'border-ui-border text-ui-muted'}`}>
                            {digit.trim() || ' '}
                        </span>
                    ))}
                </button>
            </label>
            <button disabled={busy || code.length !== 6} className='ui-button ui-button-primary h-10 px-4 text-sm disabled:cursor-not-allowed'>
                <LockKeyhole className='h-4 w-4' />
                Unlock
            </button>
        </form>
    )
}
