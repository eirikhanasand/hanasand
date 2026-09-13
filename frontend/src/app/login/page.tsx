import LoginPage from './pageClient'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Login',
    description: 'Sign in to Hanasand monitoring, webhooks, alerts, and API access.',
    path: '/login',
    keywords: ['hanasand login', 'monitoring console'],
})

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    if (params.mode === 'signup') {
        const query = new URLSearchParams()
        for (const key of ['path', 'error']) {
            const value = Array.isArray(params[key]) ? params[key][0] : params[key]
            if (value) query.set(key, value)
        }
        redirect(`/signup${query.size ? `?${query}` : ''}`)
    }
    const internal = readBooleanParam(params.internal)
    const expired = readBooleanParam(params.expired)
    const path = (Array.isArray(params.path) ? params.path[0] : params.path) || null

    const socialError = typeof params.socialError === 'string' ? params.socialError.slice(0, 400) : undefined
    return <LoginPage serverInternal={internal} path={path} serverExpired={expired} socialError={socialError} initialMode='login' serverError={typeof params.error === 'string' ? params.error.slice(0, 500) : undefined} />
}

function readBooleanParam(value: string | string[] | undefined) {
    const next = Array.isArray(value) ? value[0] : value
    return next === 'true' || next === '1'
}
