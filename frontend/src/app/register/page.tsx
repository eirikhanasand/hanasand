import RegisterPage from './pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Create Account',
    description: 'Create a Hanasand account for monitoring alerts, webhooks, and API access.',
    path: '/register',
    keywords: ['hanasand account', 'dark web monitoring account'],
})

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const internal = readBooleanParam(params.internal)
    const path = Array.isArray(params.path) ? params.path[0] : params.path

    return <RegisterPage
        serverInternal={internal}
        path={path || null}
    />
}

function readBooleanParam(value: string | string[] | undefined) {
    const next = Array.isArray(value) ? value[0] : value
    return next === 'true' || next === '1'
}
