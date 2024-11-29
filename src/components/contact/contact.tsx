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
    });

  const formik = useFormik({
        initialValues: {
            name: '',
            email: '',
            type: '',
            message: '',
        },
        validationSchema,
        onSubmit: (values) => {
            const subject = values.type;
            const body = `${values.message}\n\n${values.name}\n${values.email}`;
            const mailtoLink = `mailto:eirik.hanasand@gmail.com?cc=eirik.m.hanasand@ntnu.no&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoLink;
        }
  });

  return (
    <div className="main">
      <form onSubmit={formik.handleSubmit} title="Contact me">
        <h1 className="title" title="Contact me">
          Contact me
        </h1>
        <div>
          <h1 className="inputTitle">Name</h1>
          <input
            type="text"
            className="inputfield"
            {...formik.getFieldProps('name')}
            placeholder="Name"
          />
          {formik.touched.name && formik.errors.name && (
            <p className="error">{formik.errors.name}</p>
          )}
        </div>
        <div>
          <h1 className="inputTitle">Email Address</h1>
          <input
            type="email"
            className="inputfield"
            {...formik.getFieldProps('email')}
            placeholder="example@gmail.com"
          />
          {formik.touched.email && formik.errors.email && (
            <p className="error">{formik.errors.email}</p>
          )}
        </div>
        <div>
          <h1 className="inputTitle">Type of inquiry</h1>
          <input
            type="text"
            className="inputfield"
            {...formik.getFieldProps('type')}
            placeholder="What are you writing about?"
          />
          {formik.touched.type && formik.errors.type && (
            <p className="error">{formik.errors.type}</p>
          )}
        </div>
        <div>
          <h1 className="inputTitle">Message</h1>
          <textarea
            {...formik.getFieldProps('message')}
            placeholder="Tell me about something interesting..."
          />
          {formik.touched.message && formik.errors.message && (
            <p className="error">{formik.errors.message}</p>
          )}
        </div>
        <button
          type="submit"
          className="submit"
          style={{
            cursor: formik.isValid ? 'pointer' : 'not-allowed',
            background: formik.isValid ? 'green' : 'red',
            marginBottom: formik.isValid ? "" : "2em"
          }}
        >
          Submit
        </button>
      </form>
    </div>
  );
};