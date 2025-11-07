'use client'

import { Plus, X } from 'lucide-react'
import Certificate from './certificate'
import { useEffect, useState } from 'react'
import { getCookie, setCookie } from '@/utils/cookies'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import Notify from '../notify/notify'
import postCertificate from '@/utils/certificates/postCertificate'
import getCertificates from '@/utils/certificates/getCertificates'

export default function Certificates({ certificates: serverCertificates }: { certificates: Certificate[] | null }) {
    const [certificates, setCertificates] = useState(serverCertificates)
    const [displayNewCertificateDialog, setDisplayNewCertificateDialog] = useState(false)
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const [formData, setFormData] = useState<Partial<Certificate>>({
        name: '',
        public_key: '',
        // owner: '',
    })

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const result = await postCertificate(formData)
        if (result.status === 201) {
            setMessage(`Successfully created certificate ${formData.name}.`)
            setDisplayNewCertificateDialog(false)
            setFormData({ name: '', public_key: '' })
            update()
        } else {
            save()
            console.log(result.message)
            setMessage(result.message)
        }
    }

    async function update() {
        const id = getCookie('id')
        if (id) {
            const updatedCertificates = await getCertificates(id)
            setCertificates(updatedCertificates)
        }
    }

    function save() {
        if (formData.name) {
            setCookie('newCertificateNameInput', formData.name)
        }

        if (formData.public_key) {
            setCookie('newCertificateKeyInput', formData.public_key)
        }
    }

    function close() {
        save()
        setDisplayNewCertificateDialog(false)
    }

    useEffect(() => {
        const newCertificateNameInput = getCookie('newCertificateNameInput')
        const newCertificateKeyInput = getCookie('newCertificateKeyInput')
        // const name = getCookie('name')
        setFormData(prev => ({ 
            ...prev, 
            // Commented out - Might confuse the user until group logic has been settled.
            // owner: name || ''
            name: newCertificateNameInput || '',
            public_key: newCertificateKeyInput || ''
        }))
    }, [displayNewCertificateDialog])

    return (
        <div className='grid h-fit w-full p-2 outline-1 outline-dark rounded-lg'>
            <div className='flex justify-between mb-2 items-center'>
                <h1 className='font-semibold text-lg self-center'>Certificates</h1>
                <button
                    onClick={() => setDisplayNewCertificateDialog(true)}
                    className='flex gap-2 rounded-lg p-[3px] px-8 hover:outline-green-500/40 outline-1 outline-dark cursor-pointer hover:bg-green-500/25'
                >
                    <Plus className='stroke-bright/80' />
                    <h1 className='font-semibold text-bright/80'>Add</h1>
                </button>
            </div>
            {certificates
                ? (certificates as Certificate[]).map((certificate) => <Certificate update={update} key={certificate.id} certificate={certificate} />)
                : <>No certificates found! Click &apos;Add&apos; to add one.</>
            }
            {displayNewCertificateDialog && (
                <div
                    onClick={close}
                    className='absolute inset-0 z-20 grid place-items-center bg-black/60 backdrop-blur-sm cursor-pointer'
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className='bg-light w-[40rem] p-6 rounded-2xl shadow-xl border border-neutral-700 cursor-default'
                    >
                        <div className='flex justify-between items-center mb-4'>
                            <h1 className='font-semibold text-xl'>Add Certificate</h1>
                            <button
                                className='outline outline-neutral-700 rounded-lg hover:bg-neutral-700/30 h-8 w-8 grid place-items-center cursor-pointer'
                                onClick={close}
                            >
                                <X className='w-4 h-4 cursor-pointer' />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
                            <CertificateInputField
                                label="Name"
                                name="name"
                                value={formData.name ?? ''}
                                onChange={handleChange}
                                placeholder="My SSL Certificate"
                            />
                            {/* Commented out - Might confuse the user until group logic has been settled. */}
                            {/* <CertificateInputField
                                label="Owner"
                                name="owner"
                                value={formData.owner ?? ''}
                                onChange={handleChange}
                                placeholder="User, team or group name"
                            /> */}
                            <CertificateInputField
                                label="Public Key"
                                name="public_key"
                                value={formData.public_key ?? ''}
                                onChange={handleChange}
                                placeholder="-----BEGIN PUBLIC KEY----- ..."
                                textarea
                            />
                            <Notify background='bg-dark' fullWidth message={message} />
                            <div className='flex justify-end gap-3 mt-2'>
                                <button
                                    type='button'
                                    onClick={close}
                                    className='px-4 py-1 rounded-lg bg-neutral-800 text-white/80 hover:bg-neutral-700 transition-all cursor-pointer'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    className='px-4 py-1 rounded-lg bg-green-600 text-white/90 hover:bg-green-700 transition-all cursor-pointer'
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function CertificateInputField({
    label,
    name,
    value,
    onChange,
    placeholder,
    textarea,
    required = true
}: {
    label: string
    name: string
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    placeholder?: string
    textarea?: boolean
    required?: boolean
}) {
    return (
        <div className='flex flex-col gap-1'>
            <label htmlFor={name} className='text-sm font-semibold text-bright/80'>
                {label}
            </label>
            {textarea ? (
                <textarea
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className='bg-dark text-bright/90 p-2 rounded-lg border border-dark focus:outline-none focus:ring-2 focus:ring-green-500 resize-none h-24'
                />
            ) : (
                <input
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className='bg-dark text-bright/90 p-2 rounded-lg border border-dark focus:outline-none focus:ring-2 focus:ring-green-500'
                />
            )}
        </div>
    )
}
