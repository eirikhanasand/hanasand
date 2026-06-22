'use client'

import type { ReactNode } from 'react'
import { Building2, Mail, MessageSquareText, Send, ShieldCheck, UserRound } from 'lucide-react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import ErrorNotice from '@/components/error/errorNotice'

const fieldClassName = 'w-full rounded-lg border border-[#d8dee9] bg-white px-3 py-3 text-sm text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'

export default function Contact() {
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
            type: '',
            message: '',
        },
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
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Contact sales</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Talk through monitoring for your company, customers, or portfolio.</h1>
                        <p className='max-w-xl text-base leading-7 text-[#596170]'>
                            Send the company names, domains, actor concerns, or supplier watchlist you care about. The reply can cover coverage, pricing, and how the metadata would be delivered.
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
