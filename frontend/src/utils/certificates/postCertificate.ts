'use client'

import config from '@/config'
import { getCookie } from '../cookies'

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
        const timeout = setTimeout(() => controller.abort(), 1000)
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
        if (!response.ok) {
            throw new Error(await response.text())
        }

        return {
            status: response.status,
            message: `Created certificate ${certificate.name}.`
        }
    } catch (error) {
        console.log(error)
        return {
            status: 500,
            message: `Failed to create certificate ${certificate.name}.`
        }
    }
}
