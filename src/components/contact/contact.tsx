'use client'
import React from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import './contact.css'

export default function Contact() {
    const validationSchema = Yup.object().shape({
        name: Yup.string().required('Name is required'),
        email: Yup.string().email('Invalid email').required('Email is required'),
        type: Yup.string().min(5, 'Type must be at least 5 characters').required('Type is required'),
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

    return (
        <div className="grid place-items-center min-h-[95vh]">
            <form onSubmit={formik.handleSubmit} title="Contact me">
                <h1 className="text-foreground text-2xl mb-5" title="Contact me">
                    Contact me
                </h1>
                <div className='mb-5'>
                    <h1 className="text-md text-foreground">Name</h1>
                    <input
                        type="text"
                        className="w-[98%] rounded-lg h-10 bg-light pl-2 text-foreground"
                        {...formik.getFieldProps('name')}
                        placeholder="Name"
                    />
                    {formik.touched.name && formik.errors.name && (
                        <p className="error">{formik.errors.name}</p>
                    )}
                </div>
                <div className='mb-5'>
                    <h1 className="text-md text-foreground">Email Address</h1>
                    <input
                        type="email"
                        className="w-[98%] rounded-lg h-10 bg-light pl-2 text-foreground"
                        {...formik.getFieldProps('email')}
                        placeholder="example@mail.com"
                    />
                    {formik.touched.email && formik.errors.email && (
                        <p className="error">{formik.errors.email}</p>
                    )}
                </div>
                <div className='mb-5'>
                    <h1 className="text-md text-foreground">Subject</h1>
                    <input
                        type="text"
                        className="w-[98%] rounded-lg h-10 bg-light pl-2 text-foreground"
                        {...formik.getFieldProps('type')}
                        placeholder="What are you writing about?"
                    />
                    {formik.touched.type && formik.errors.type && (
                        <p className="error">{formik.errors.type}</p>
                    )}
                </div>
                <div className='mb-5'>
                    <h1 className="text-md text-foreground">Message</h1>
                    <textarea
                        {...formik.getFieldProps('message')}
                        placeholder="Tell me about something interesting..."
                        className="w-[98%] rounded-lg h-10 bg-light pl-2 text-foreground"
                    />
                    {formik.touched.message && formik.errors.message && (
                        <p className="error">{formik.errors.message}</p>
                    )}
                </div>
                <button
                    type="submit"
                    className="grid w-[98%] mt-5 rounded-xl h-12 place-items-center text-xl text-white"
                    style={{
                        cursor: formik.isValid ? 'pointer' : 'not-allowed',
                        background: formik.isValid ? 'green' : 'red',
                        marginBottom: formik.isValid ? "" : "2em"
                    }}
                >
                    Submit
                </button>
            </form>
            <div className='text-gray-500 grid place-items-center'>
                <h1>more stuff coming soon &lt;3 if only there were 48 hours in a day...</h1>
            </div>
        </div>
    )
}
