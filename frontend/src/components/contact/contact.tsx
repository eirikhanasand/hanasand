'use client'

import type { ReactNode } from 'react'
import { Building2, Mail, MessageSquareText, Send, ShieldCheck, UserRound } from 'lucide-react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import ErrorNotice from '@/components/error/errorNotice'

const fieldClassName = 'w-full rounded-lg border border-[#d8dee9] bg-white px-3 py-3 text-sm text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'

type ContactIntent = {
    subject: string
    message: string
    eyebrow: string
    heading: string
    detail: string
}

export default function Contact({ plan = '', intent = '' }: { plan?: string; intent?: string }) {
    const contactIntent = getContactIntent(plan, intent)
    const validationSchema = Yup.object().shape({
        name: Yup.string().required('Name is required'),
        email: Yup.string().email('Invalid email').required('Email is required'),
        type: Yup.string().min(5, 'Subject must be at least 5 characters').required('Subject is required'),
        message: Yup.string().min(20, 'Message must be at least 20 characters').required('Message is required'),
    })

    const formik = useFormik({
        initialValues: {
            name: '',
            email: '',
            type: contactIntent.subject,
            message: contactIntent.message,
        },
        enableReinitialize: true,
        validationSchema,
        onSubmit: (values) => {
            const subject = values.type
            const body = `${values.message}\n\n${values.name}\n${values.email}`
            const mailtoLink = `mailto:eirik@hanasand.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
            window.location.href = mailtoLink
        }
    })

    const canSubmit = formik.isValid && formik.dirty

    return (
        <section className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] px-4 py-12 text-[#171a21] md:px-8 md:py-18'>
            <div className='mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start'>
                <div className='grid gap-6'>
                    <div className='grid gap-4'>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>{contactIntent.eyebrow}</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>{contactIntent.heading}</h1>
                        <p className='max-w-xl text-base leading-7 text-[#596170]'>
                            {contactIntent.detail}
                        </p>
                    </div>

                    <div className='grid gap-3'>
                        <ContactPoint icon={<ShieldCheck className='h-4.5 w-4.5' />} title='Threat monitoring' detail='Company and supplier exposure alerts from recent actor activity.' />
                        <ContactPoint icon={<Building2 className='h-4.5 w-4.5' />} title='Buyer fit' detail='Best for teams that need fast notification, clean fields, and reviewable context.' />
                        <ContactPoint icon={<Mail className='h-4.5 w-4.5' />} title='Direct email' detail='eirik@hanasand.com' />
                    </div>
                </div>

                <form className='grid gap-5 rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-[0_20px_70px_rgba(26,35,55,0.10)] md:p-7' onSubmit={formik.handleSubmit} title='Contact sales'>
                    <div className='grid gap-1'>
                        <h2 className='text-xl font-semibold'>Start a conversation</h2>
                        <p className='text-sm text-[#667085]'>This opens a drafted email with your details filled in.</p>
                    </div>

                    <Field
                        icon={<UserRound className='h-4 w-4 text-[#697386]' />}
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
                        icon={<Mail className='h-4 w-4 text-[#697386]' />}
                        label='Email Address'
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
                        icon={<MessageSquareText className='h-4 w-4 text-[#697386]' />}
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
                        icon={<MessageSquareText className='h-4 w-4 text-[#697386]' />}
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
                        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${canSubmit ? 'bg-[#171a21] text-white hover:bg-[#2b2f39]' : 'cursor-not-allowed border border-[#d8dee9] bg-[#f5f7fb] text-[#98a2b3]'}`}
                        disabled={!canSubmit}
                    >
                        <Send className='h-4 w-4' />
                        Send
                    </button>
                </form>
            </div>
        </section>
    )
}

function ContactPoint({ icon, title, detail }: { icon: ReactNode, title: string, detail: string }) {
    return (
        <div className='grid grid-cols-[2.75rem_1fr] gap-3 rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm'>
            <span className='grid h-11 w-11 place-items-center rounded-lg border border-[#e1e7f0] bg-[#f8fafc] text-[#3056d3]'>
                {icon}
            </span>
            <span className='grid gap-1'>
                <span className='font-semibold text-[#171a21]'>{title}</span>
                <span className='text-sm leading-6 text-[#596170]'>{detail}</span>
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
            <span className='flex items-center gap-2 text-sm font-semibold text-[#344054]'>
                {icon}
                {label}
            </span>
            {children}
            {error && <ErrorNotice compact message={error} />}
        </label>
    )
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
        eyebrow: 'Contact sales',
        heading: 'Talk through monitoring for your company, customers, or portfolio.',
        detail: 'Send the company names, domains, actor concerns, or supplier watchlist you care about. The reply can cover coverage, pricing, and how the alert data would be delivered.',
    }
}
