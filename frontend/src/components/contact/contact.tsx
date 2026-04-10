'use client'

import { Mail, MessageSquareText, Send, UserRound } from 'lucide-react'
import { useFormik } from 'formik'
import * as Yup from 'yup'

const fieldClassName = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-foreground outline-none transition focus:border-orange-300/45'

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
            const mailtoLink = `mailto:eirik.hanasand@gmail.com?cc=eirik.m.hanasand@ntnu.no&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
            window.location.href = mailtoLink
        }
    })

    const canSubmit = formik.isValid && formik.dirty

    return (
        <section className='grid min-h-[90.5vh] place-items-center px-4 py-10 md:px-10 lg:px-20'>
            <form className='grid w-full max-w-3xl gap-5 rounded-xl border border-white/10 bg-white/4 p-5 backdrop-blur-md md:p-8' onSubmit={formik.handleSubmit} title='Contact me'>
                <div className='grid gap-2'>
                    <div className='flex items-center gap-3 text-bright'>
                        <Mail className='h-5 w-5 text-orange-300' />
                        <h1 className='text-2xl font-semibold'>Contact</h1>
                    </div>
                    <p className='text-sm text-bright/55'>Write directly and it opens a drafted email with the details filled in.</p>
                </div>

                <Field
                    icon={<UserRound className='h-4 w-4 text-bright/40' />}
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
                    icon={<Mail className='h-4 w-4 text-bright/40' />}
                    label='Email Address'
                    error={formik.touched.email ? formik.errors.email : undefined}
                >
                    <input
                        type='email'
                        className={fieldClassName}
                        {...formik.getFieldProps('email')}
                        placeholder='example@mail.com'
                    />
                </Field>

                <Field
                    icon={<MessageSquareText className='h-4 w-4 text-bright/40' />}
                    label='Subject'
                    error={formik.touched.type ? formik.errors.type : undefined}
                >
                    <input
                        type='text'
                        className={fieldClassName}
                        {...formik.getFieldProps('type')}
                        placeholder='What are you writing about?'
                    />
                </Field>

                <Field
                    icon={<MessageSquareText className='h-4 w-4 text-bright/40' />}
                    label='Message'
                    error={formik.touched.message ? formik.errors.message : undefined}
                >
                    <textarea
                        {...formik.getFieldProps('message')}
                        placeholder='Tell me about something interesting...'
                        className={`${fieldClassName} min-h-48 resize-y`}
                    />
                </Field>

                <button
                    type='submit'
                    className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${canSubmit ? 'bg-orange-300 text-background hover:bg-orange-200' : 'cursor-not-allowed border border-white/10 bg-white/5 text-bright/35'}`}
                    disabled={!canSubmit}
                >
                    <Send className='h-4 w-4' />
                    Send
                </button>
            </form>
        </section>
    )
}

function Field({
    label,
    icon,
    error,
    children
}: {
    label: string
    icon: React.ReactNode
    error?: string
    children: React.ReactNode
}) {
    return (
        <label className='grid gap-2'>
            <span className='flex items-center gap-2 text-sm font-medium text-bright/80'>
                {icon}
                {label}
            </span>
            {children}
            {error && <p className='text-sm text-red-300'>{error}</p>}
        </label>
    )
}
