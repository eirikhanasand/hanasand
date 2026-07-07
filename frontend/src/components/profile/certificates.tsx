'use client'

import { Plus, X } from 'lucide-react'
import Certificate from './certificate'
import { useEffect, useState } from 'react'
import { getCookie, removeCookie, setCookie } from '@/utils/cookies/cookies'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import Notify from '../notify/notify'
import postCertificate from '@/utils/certificates/postCertificate'
import getCertificates from '@/utils/certificates/getCertificates'
import { DashboardPanel } from '@/components/dashboard/ui'

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

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault()
        const result = await postCertificate(formData)

        if (result.status === 201) {
            await update()
            setMessage(`Successfully created certificate ${formData.name}.`)
            setDisplayNewCertificateDialog(false)
            setFormData({ name: '', public_key: '' })
            clear()
        } else {
            save()
            setMessage(result.message)
        }
    }

    async function update() {
        const id = getCookie('id')
        const token = getCookie('access_token')
        if (id) {
            const updatedCertificates = await getCertificates(id, token, id)
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

    function clear() {
        removeCookie('newCertificateNameInput')
        removeCookie('newCertificateKeyInput')
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
        <DashboardPanel className='h-fit p-4'>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>Certificates</h2>
                    <p className='mt-1 text-sm text-ui-muted'>{certificates?.length || 0} configured</p>
                </div>
                <button
                    onClick={() => setDisplayNewCertificateDialog(true)}
                    className='flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:text-ui-primary'
                >
                    <Plus className='h-4 w-4' />
                    Add
                </button>
            </div>
            <div className='mt-4 grid gap-2'>
                {certificates?.length
                    ? (certificates as Certificate[]).map((certificate) => <Certificate update={update} key={certificate.id} certificate={certificate} />)
                    : <div className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>Certificate inventory is ready. Add a certificate to start the account trust stream.</div>
                }
            </div>
            {displayNewCertificateDialog && (
                <div
                    onClick={close}
                    className='fixed inset-0 z-50 grid cursor-pointer place-items-center bg-ui-canvas/75 px-4 backdrop-blur-sm'
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className='w-full max-w-xl cursor-default rounded-xl border border-ui-border bg-ui-panel p-4 shadow-2xl'
                    >
                        <div className='mb-4 flex items-center justify-between'>
                            <h1 className='text-lg font-semibold text-ui-text'>Add certificate</h1>
                            <button
                                className='grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:border-ui-primary hover:bg-ui-raised hover:text-ui-text'
                                onClick={close}
                            >
                                <X className='w-4 h-4 cursor-pointer' />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
                            <CertificateInputField
                                label='Name'
                                name='name'
                                value={formData.name ?? ''}
                                onChange={handleChange}
                                placeholder='Work laptop'
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
                                label='Public Key'
                                name='public_key'
                                value={formData.public_key ?? ''}
                                onChange={handleChange}
                                placeholder='-----BEGIN PUBLIC KEY----- ...'
                                textarea
                            />
                            <Notify background='bg-ui-panel' fullWidth message={message} />
                            <div className='mt-2 flex justify-end gap-2'>
                                <button
                                    type='button'
                                    onClick={close}
                                    className='h-9 cursor-pointer rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='submit'
                                    className='h-9 cursor-pointer rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardPanel>
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
            <label htmlFor={name} className='text-sm font-semibold text-ui-text'>
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
                    className='h-24 resize-none rounded-lg border border-ui-border bg-ui-raised p-2 text-ui-text placeholder:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/40'
                />
            ) : (
                <input
                    id={name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    className='rounded-lg border border-ui-border bg-ui-raised p-2 text-ui-text placeholder:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/40'
                />
            )}
        </div>
    )
}
