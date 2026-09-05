'use client'

import { useId } from 'react'
import { Clock3, Info, ShieldCheck, ShieldX } from 'lucide-react'
import type { AgentAutomation } from '@/utils/automations/client'

export default function CertificateStatus({ automation }: { automation: AgentAutomation }) {
    const id = useId()
    const socketTls = automation.monitoringType === 'tcp' && /:443$/.test(automation.targetUrl || '')
    const applies = automation.actionType === 'agent_prompt' && (socketTls || automation.monitoringType !== 'ssh' && automation.monitoringType !== 'tcp' && /^https:/i.test(automation.targetUrl || ''))
    const status = applies ? automation.certificateStatus === 'not_applicable' ? null : automation.certificateStatus : 'not_applicable'
    const label = status === 'not_applicable' ? 'Not needed' : status === 'valid' ? 'Valid' : status === 'invalid' ? 'Invalid' : status === 'expiring' ? 'Expiring' : 'Pending'
    const Icon = status === 'not_applicable' ? Info : status === 'valid' ? ShieldCheck : status ? ShieldX : Clock3
    const color = status === 'valid' ? 'text-ui-success' : status === 'invalid' ? 'text-ui-danger' : status === 'expiring' ? 'text-ui-warning' : 'text-ui-muted'
    const explanation = automation.monitoringType === 'ssh' || automation.monitoringType === 'tcp' && /:22$/.test(automation.targetUrl || '')
        ? 'This check tests SSH connectivity. SSH uses host keys, not HTTPS certificates; this check does not validate those keys.'
        : automation.actionType !== 'agent_prompt'
            ? 'This automation does not check a TLS connection, so a website certificate is not needed.'
            : automation.monitoringType === 'tcp'
                ? 'This is a plain TCP connectivity check. It does not inspect TLS certificates. TCP checks on port 443 also validate TLS.'
                : 'This target uses HTTP without TLS, so there is no certificate to inspect. This does not mean the connection is encrypted.'
    return <div className='relative z-10'>
        <button type='button' popoverTarget={id} aria-label={`Certificate: ${label} — ${automation.name}`} className={`inline-flex items-center gap-1 rounded px-1 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary ${color}`}>
            <Icon aria-hidden='true' className='h-4 w-4 shrink-0' />{label}
        </button>
        <div id={id} popover='auto' className='m-auto w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-ui-border bg-ui-raised p-4 text-sm text-ui-text shadow-lg'>
            <p className='font-semibold'>{automation.name} · Certificate: {label}</p>
            <p className='mt-2 leading-6 text-ui-muted'>{!applies ? explanation : status === 'valid' ? 'The TLS certificate is trusted, matches the hostname and is within its validity period.' : status === 'expiring' ? 'The TLS certificate is trusted but expires within 30 days.' : status === 'invalid' ? 'The TLS certificate failed validation. Check its hostname, expiry date and issuing authority.' : 'Certificate verification has not completed yet. The next scheduled check will update this status.'}</p>
            {applies && automation.certificateSubject && <p className='mt-2 wrap-break-word'>Issued to: {automation.certificateSubject}</p>}
            {applies && automation.certificateIssuer && <p className='mt-1 wrap-break-word'>Issuer: {automation.certificateIssuer}</p>}
            {applies && automation.certificateExpiresAt && <p className='mt-1'>Expires: {new Date(automation.certificateExpiresAt).toLocaleString()}</p>}
            <button type='button' popoverTarget={id} popoverTargetAction='hide' className='mt-3 rounded border border-ui-border px-3 py-1 text-xs'>Close</button>
        </div>
    </div>
}
