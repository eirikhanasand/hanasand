import LoginPage from './pageClient'
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
    const internal = readBooleanParam(params.internal)
    const expired = readBooleanParam(params.expired)
    const path = (Array.isArray(params.path) ? params.path[0] : params.path) || null

    return <LoginPage serverInternal={internal} path={path} serverExpired={expired} />
}

function readBooleanParam(value: string | string[] | undefined) {
    const next = Array.isArray(value) ? value[0] : value
    return next === 'true' || next === '1'
}
