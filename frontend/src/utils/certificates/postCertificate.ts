'use client'

import config from '@/config'
import { getCookie } from '../cookies/cookies'

export default async function postCertificate(certificate: Partial<Certificate>): Promise<{ status: number, message: string }> {
    try {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return {
                status: 401,
                message: 'Please log in to post certificates.'
            }
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.abortTimeout)
        const response = await fetch(`${config.url.api}/certificates`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`, 
                id
            },
            body: JSON.stringify({ ...certificate }),
            signal: controller.signal
        })

        clearTimeout(timeout)

        if (response.status === 409) {
            throw new Error('conflict')
        }

        if (!response.ok) {
            throw new Error(await response.text())
        }

        return {
            status: response.status,
            message: `Created certificate ${certificate.name}.`
        }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.message === 'conflict') {
            return {
                status: 409,
                message: `You already have a certificate with this name.`
            }
        }

        return {
            status: 500,
            message: `Failed to create certificate ${certificate.name}.`
        }
    }
}
