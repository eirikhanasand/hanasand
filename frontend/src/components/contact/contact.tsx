'use client'

import type { ReactNode } from 'react'
import { Building2, CheckCircle2, Clock3, FileCheck2, LoaderCircle, Mail, MessageSquareText, Route, Send, ShieldCheck, UserRound } from 'lucide-react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import ErrorNotice from '@/components/error/errorNotice'
import { useState } from 'react'

const fieldClassName = 'w-full rounded-lg border border-ui-border bg-ui-panel px-3 py-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'

type ContactIntent = {
    subject: string
    message: string
    eyebrow: string
    heading: string
    detail: string
}

type ContactResult = {
    ticketId: string
    nextStep: string
}

const deliveryOptions = [
    ['email', 'Email'],
    ['webhook', 'Webhook'],
    ['api', 'API'],
    ['review-link', 'Review link'],
    ['not-sure', 'Not sure yet'],
]

const replyWindowOptions = [
    ['same-day', 'Same day'],
    ['two-business-days', 'Two business days'],
    ['this-week', 'This week'],
    ['planning', 'Planning ahead'],
]

const intakeSteps = [
    ['Coverage fit', 'Confirm whether the names, domains, suppliers, or actors are sensible to monitor now.'],
    ['Delivery path', 'Pick email, webhook, API, or shared review links for the first alerts.'],
    ['Security review', 'Package DPA, subprocessors, SLA notes, identity requirements, and current control gaps.'],
]

const reviewPacketRows = [
    ['Pilot scope', 'Watched names, domains, suppliers, alert owner, and first-month success criteria.'],
    ['Delivery setup', 'Email, webhook, API, or shared review link path with the fields your team needs.'],
    ['Security packet', 'DPA notes, subprocessors, SLA expectations, identity requirements, and current certification limits.'],
]

export default function Contact({ plan = '', intent = '' }: { plan?: string; intent?: string }) {
    const contactIntent = getContactIntent(plan, intent)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [result, setResult] = useState<ContactResult | null>(null)
    const validationSchema = Yup.object().shape({
        name: Yup.string().required('Name is required'),
        email: Yup.string().email('Invalid email').required('Email is required'),
        company: Yup.string(),
        type: Yup.string().min(5, 'Subject must be at least 5 characters').required('Subject is required'),
        message: Yup.string().min(20, 'Message must be at least 20 characters').required('Message is required'),
    })

    const formik = useFormik({
        initialValues: {
            name: '',
            email: '',
            company: '',
            type: contactIntent.subject,
            message: contactIntent.message,
            deliveryPreference: 'email',
            replyWindow: normalizedContactReplyWindow(intent),
            securityReview: normalizedSecurityIntent(intent),
        },
        enableReinitialize: true,
        validationSchema,
        onSubmit: async (values) => {
            setSubmitting(true)
            setSubmitError('')
            setResult(null)
            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: values.name,
                        email: values.email,
                        company: values.company,
                        subject: values.type,
                        message: values.message,
                        intent,
                        plan,
                        deliveryPreference: values.deliveryPreference,
                        replyWindow: values.replyWindow,
                        securityReview: values.securityReview,
                    }),
                })
                const payload = await response.json().catch(() => ({})) as { error?: string, ticketId?: string, nextStep?: string }
                if (!response.ok || payload.error) {
                    throw new Error(payload.error || 'Unable to send the request right now.')
                }
                setResult({
                    ticketId: payload.ticketId || 'received',
                    nextStep: payload.nextStep || 'We received the request and will reply by email.',
                })
                formik.resetForm({ values })
            } catch (error) {
                setSubmitError(error instanceof Error ? error.message : 'Unable to send the request right now.')
            } finally {
                setSubmitting(false)
            }
        }
    })

    const canSubmit = formik.isValid && formik.dirty && !submitting

    return (
        <section className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-12 text-ui-text md:px-8 md:py-18'>
            <div className='mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start'>
                <div className='grid gap-6'>
                    <div className='grid gap-4'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>{contactIntent.eyebrow}</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>{contactIntent.heading}</h1>
                        <p className='max-w-xl text-base leading-7 text-ui-muted'>
                            {contactIntent.detail}
                        </p>
                    </div>

                    <div className='grid gap-3'>
                        <ContactPoint icon={<ShieldCheck className='h-4.5 w-4.5' />} title='Threat monitoring' detail='Company and supplier exposure alerts from recent actor activity.' />
                        <ContactPoint icon={<Building2 className='h-4.5 w-4.5' />} title='Buyer fit' detail='Best for teams that need fast notification, clean fields, and reviewable context.' />
                        <ContactPoint icon={<MessageSquareText className='h-4.5 w-4.5' />} title='Procurement review' detail='Request DPA, subprocessor details, SLA notes, security questionnaire, and identity requirements.' />
                        <ContactPoint icon={<Mail className='h-4.5 w-4.5' />} title='Direct email' detail='eirik@hanasand.com' />
                    </div>

                    <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>What happens next</p>
                        <div className='grid gap-3'>
                            {intakeSteps.map(([title, detail]) => (
                                <div key={title} className='grid gap-1 rounded-lg border border-ui-border bg-ui-raised p-3'>
                                    <span className='text-sm font-semibold text-ui-text'>{title}</span>
                                    <span className='text-sm leading-6 text-ui-muted'>{detail}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                        <div className='border-b border-ui-border bg-ui-raised px-4 py-3'>
                            <p className='text-sm font-semibold uppercase text-ui-primary'>Review packet</p>
                            <p className='mt-1 text-sm leading-6 text-ui-muted'>A good request should leave with a concrete pilot shape, not a generic sales thread.</p>
                        </div>
                        <div className='divide-y divide-ui-border'>
                            {reviewPacketRows.map(([label, detail]) => (
                                <div key={label} className='grid gap-1 px-4 py-3 text-sm sm:grid-cols-[8rem_1fr] sm:gap-4'>
                                    <span className='font-semibold text-ui-text'>{label}</span>
                                    <span className='leading-6 text-ui-muted'>{detail}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <form className='grid gap-5 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-lg md:p-7' onSubmit={formik.handleSubmit} title={contactIntent.eyebrow}>
                    <div className='grid gap-1'>
                        <h2 className='text-xl font-semibold'>Start a conversation</h2>
                        <p className='text-sm text-ui-muted'>Send the request here so it can be tracked. Direct email stays available as a fallback.</p>
                    </div>

                    {result ? (
                        <div className='rounded-lg border border-ui-success/35 bg-ui-success/10 p-4 text-sm leading-6 text-ui-success'>
                            <div className='flex items-center gap-2 font-semibold'>
                                <CheckCircle2 className='h-4 w-4' />
                                Request received
                            </div>
                            <p className='mt-2'>Ticket <span className='font-mono font-semibold'>{result.ticketId}</span>. {result.nextStep}</p>
                            <p className='mt-1 text-xs font-semibold uppercase tracking-normal'>Route: {deliveryLabel(formik.values.deliveryPreference)} · Reply: {replyWindowLabel(formik.values.replyWindow)}</p>
                        </div>
                    ) : null}

                    <ErrorNotice compact message={submitError} />

                    <Field
                        icon={<UserRound className='h-4 w-4 text-ui-muted' />}
                        label='Name'
                        error={formik.touched.name ? formik.errors.name : undefined}
                    >
                        <input
                            type='text'
                            className={fieldClassName}
                            {...formik.getFieldProps('name')}
                            placeholder='Name'
                        />
                    </Field>

                    <Field
                        icon={<Mail className='h-4 w-4 text-ui-muted' />}
                        label='Work email'
                        error={formik.touched.email ? formik.errors.email : undefined}
                    >
                        <input
                            type='email'
                            className={fieldClassName}
                            {...formik.getFieldProps('email')}
                            placeholder='name@company.com'
                        />
                    </Field>

                    <Field
                        icon={<Building2 className='h-4 w-4 text-ui-muted' />}
                        label='Company or team'
                        error={formik.touched.company ? formik.errors.company : undefined}
                    >
                        <input
                            type='text'
                            className={fieldClassName}
                            {...formik.getFieldProps('company')}
                            placeholder='Acme Security'
                            autoComplete='organization'
                        />
                    </Field>

                    <div className='grid gap-4 md:grid-cols-2' data-contact-intake-routing='true'>
                        <Field
                            icon={<Route className='h-4 w-4 text-ui-muted' />}
                            label='Preferred delivery'
                            error={formik.touched.deliveryPreference ? formik.errors.deliveryPreference : undefined}
                        >
                            <select
                                className={fieldClassName}
                                {...formik.getFieldProps('deliveryPreference')}
                            >
                                {deliveryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </Field>

                        <Field
                            icon={<Clock3 className='h-4 w-4 text-ui-muted' />}
                            label='Reply window'
                            error={formik.touched.replyWindow ? formik.errors.replyWindow : undefined}
                        >
                            <select
                                className={fieldClassName}
                                {...formik.getFieldProps('replyWindow')}
                            >
                                {replyWindowOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </Field>
                    </div>

                    <label className='flex items-start gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-3 text-sm leading-6 text-ui-text' data-contact-security-review='true'>
                        <input
                            type='checkbox'
                            className='mt-1 h-4 w-4 rounded border-ui-border text-ui-primary focus:ring-ui-primary/20'
                            checked={formik.values.securityReview}
                            onChange={event => formik.setFieldValue('securityReview', event.target.checked)}
                        />
                        <span className='grid gap-1'>
                            <span className='flex items-center gap-2 font-semibold'><FileCheck2 className='h-4 w-4 text-ui-muted' /> Include security review material</span>
                            <span className='text-xs leading-5 text-ui-muted'>DPA notes, subprocessors, SLA expectations, identity requirements, and current certification limits.</span>
                        </span>
                    </label>

                    <Field
                        icon={<MessageSquareText className='h-4 w-4 text-ui-muted' />}
                        label='Subject'
                        error={formik.touched.type ? formik.errors.type : undefined}
                    >
                        <input
                            type='text'
                            className={fieldClassName}
                            {...formik.getFieldProps('type')}
                            placeholder='Threat monitoring for Acme'
                        />
                    </Field>

                    <Field
                        icon={<MessageSquareText className='h-4 w-4 text-ui-muted' />}
                        label='Message'
                        error={formik.touched.message ? formik.errors.message : undefined}
                    >
                        <textarea
                            {...formik.getFieldProps('message')}
                            placeholder='Tell me what you want monitored and how quickly you need to know.'
                            className={`${fieldClassName} min-h-44 resize-y`}
                        />
                    </Field>

                    <button
                        type='submit'
                        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${canSubmit ? 'bg-ui-primary text-ui-canvas hover:bg-ui-primary/90' : 'cursor-not-allowed border border-ui-border bg-ui-raised text-ui-muted'}`}
                        disabled={!canSubmit}
                    >
                        {submitting ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                        {submitting ? 'Sending' : 'Send request'}
                    </button>
                    <a href='mailto:eirik@hanasand.com' className='text-center text-sm font-semibold text-ui-primary hover:text-ui-primary/80'>
                        Email eirik@hanasand.com instead
                    </a>
                </form>
            </div>
        </section>
    )
}

function ContactPoint({ icon, title, detail }: { icon: ReactNode, title: string, detail: string }) {
    return (
        <div className='grid grid-cols-[2.75rem_1fr] gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
            <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                {icon}
            </span>
            <span className='grid gap-1'>
                <span className='font-semibold text-ui-text'>{title}</span>
                <span className='text-sm leading-6 text-ui-muted'>{detail}</span>
            </span>
        </div>
    )
}

function Field({
    label,
    icon,
    error,
    children
}: {
    label: string
    icon: ReactNode
    error?: string
    children: ReactNode
}) {
    return (
        <label className='grid gap-2'>
            <span className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                {icon}
                {label}
            </span>
            {children}
            {error && <ErrorNotice compact message={error} />}
        </label>
    )
}

function normalizedContactReplyWindow(intent: string) {
    const normalizedIntent = intent.trim().toLowerCase()
    if (normalizedIntent === 'support') return 'same-day'
    if (normalizedIntent === 'procurement' || normalizedIntent === 'enterprise' || normalizedIntent === 'security') return 'this-week'
    return 'two-business-days'
}

function normalizedSecurityIntent(intent: string) {
    const normalizedIntent = intent.trim().toLowerCase()
    return normalizedIntent === 'procurement' || normalizedIntent === 'enterprise' || normalizedIntent === 'security'
}

function deliveryLabel(value: string) {
    return deliveryOptions.find(([option]) => option === value)?.[1] || 'Email'
}

function replyWindowLabel(value: string) {
    return replyWindowOptions.find(([option]) => option === value)?.[1] || 'Two business days'
}

function getContactIntent(plan: string, intent: string): ContactIntent {
    const normalizedPlan = plan.trim().toLowerCase()
    const normalizedIntent = intent.trim().toLowerCase()

    if (normalizedIntent === 'dwm') {
        return {
            subject: 'Start dark web monitoring',
            message: 'I want to monitor company, vendor, and domain mentions across recent ransomware and extortion activity.\n\nWatchlist size:\nDelivery preference: webhook / email / API\nTeam or company context:',
            eyebrow: 'Dark web monitoring',
            heading: 'Start monitoring the names that matter.',
            detail: 'Send the companies, domains, suppliers, product names, or executive names you want watched. The reply can cover coverage, alert delivery, and the fastest path to a pilot.',
        }
    }

    if (normalizedIntent === 'sales') {
        return {
            subject: 'Threat monitoring sales request',
            message: 'I want to discuss Hanasand monitoring for company, vendor, domain, or portfolio exposure.\n\nWhat I want watched:\nDelivery preference:\nTimeline:',
            eyebrow: 'Contact sales',
            heading: 'Talk through monitoring for your company, customers, or portfolio.',
            detail: 'Send the company names, domains, actor concerns, or supplier watchlist you care about. The reply can cover coverage, pricing, and how the alert data would be delivered.',
        }
    }

    if (normalizedIntent === 'reports') {
        return {
            subject: 'Shared monitoring reports',
            message: 'I want to package monitoring results into customer-ready review links or follow-up workflows.\n\nWhat needs to be shared:\nWho reviews it:\nDelivery preference:',
            eyebrow: 'Shared reports',
            heading: 'Turn exposure findings into a clean customer report.',
            detail: 'Send the kind of monitoring result you want to share and who needs to review it. The reply can map webhook alerts, review links, and follow-up workflow into one buyer-ready report.',
        }
    }

    if (normalizedIntent === 'api') {
        return {
            subject: 'Monitoring API access',
            message: 'I want API or webhook access for company exposure alerts.\n\nSystem to connect:\nFields needed:\nExpected watchlist size:\nDelivery timeline:',
            eyebrow: 'API access',
            heading: 'Connect Hanasand alerts to your workflow.',
            detail: 'Send the system you want to connect, the fields you need, and how the alerts should be delivered. The reply can cover webhook setup, payload shape, and pricing.',
        }
    }

    if (normalizedIntent === 'support') {
        return {
            subject: 'Support request',
            message: 'I need help with Hanasand.\n\nPage or feature:\nWhat happened:\nWhat I expected:\nAccount email, if relevant:',
            eyebrow: 'Support',
            heading: 'Get help with an account, webhook, API, or terms question.',
            detail: 'Send the route, account email, webhook, or API workflow you need help with. Support can help with access, billing questions, endpoint changes, and terms-of-service questions.',
        }
    }

    if (normalizedIntent === 'procurement' || normalizedIntent === 'enterprise' || normalizedIntent === 'security') {
        return {
            subject: 'Enterprise security and procurement review',
            message: 'I need the Hanasand enterprise review packet.\n\nOrganization:\nVendor portal or questionnaire link:\nJurisdiction / DPA requirements:\nSecurity controls required:\nSSO / SCIM requirements:\nSLA or support requirements:\nProcurement deadline:',
            eyebrow: 'Enterprise review',
            heading: 'Request security, DPA, SLA, and procurement material.',
            detail: 'Send the vendor portal, required controls, deadline, identity requirements, and contract needs. The reply can cover DPA, subprocessors, SLA/support terms, security questionnaire responses, and onboarding scope.',
        }
    }

    if (normalizedPlan === 'pilot') {
        return {
            subject: 'Start Pilot threat monitoring',
            message: 'I want to start the Pilot plan for up to 25 watched names or domains.\n\nNames/domains to monitor:\nDelivery preference:\nTiming:',
            eyebrow: 'Pilot plan',
            heading: 'Start a focused monitoring pilot.',
            detail: 'Send the first names or domains you want monitored. The reply can confirm coverage, delivery format, and what the first alerts will look like.',
        }
    }

    if (normalizedPlan === 'company-monitor') {
        return {
            subject: 'Company Monitor sales request',
            message: 'I want to discuss Company Monitor for brand, subsidiary, vendor, or executive-name monitoring.\n\nApproximate watchlist size:\nDelivery preference:\nMain risk concerns:',
            eyebrow: 'Company Monitor',
            heading: 'Talk through monitoring for your company and vendors.',
            detail: 'Send the watchlist shape, delivery preference, and the kinds of exposure you care about. The reply can cover pricing, webhook setup, and review workflow.',
        }
    }

    if (normalizedPlan === 'portfolio') {
        return {
            subject: 'Portfolio monitoring coverage',
            message: 'I want to discuss portfolio or supplier-network monitoring.\n\nApproximate number of companies/domains:\nDelivery preference:\nCoverage needs:',
            eyebrow: 'Portfolio monitoring',
            heading: 'Monitor customers, suppliers, or portfolio companies.',
            detail: 'Send the portfolio size, supplier list shape, or customer monitoring workflow you want covered. The reply can map the right plan and data delivery format.',
        }
    }

    return {
        subject: '',
        message: '',
        eyebrow: 'Contact',
        heading: 'Send a product, support, or monitoring request.',
        detail: 'Use this page for monitoring questions, support requests, API setup, webhook changes, or account help.',
    }
}
