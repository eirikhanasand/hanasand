'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export default function CopyCodeButton({ value, label = 'Copy' }: { value: string, label?: string }) {
    const [copied, setCopied] = useState(false)
    async function copy() {
        try {
            await navigator.clipboard.writeText(value)
        } catch {
            const input = document.createElement('textarea')
            input.value = value
            input.style.position = 'fixed'
            input.style.opacity = '0'
            document.body.appendChild(input)
            input.select()
            const copied = document.execCommand('copy')
            input.remove()
            if (!copied) return
        }
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
    }
    return (
        <button type='button' onClick={copy} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary focus:outline-none focus:ring-2 focus:ring-ui-primary/30' aria-label={`${label} code`}>
            {copied ? <Check className='h-3.5 w-3.5 text-ui-success' /> : <Copy className='h-3.5 w-3.5' />}
            {copied ? 'Copied' : label}
        </button>
    )
}
