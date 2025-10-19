import LoginPage from './pageClient'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const internal = Boolean(Array.isArray(params.internal) ? params.internal[0] : params.internal) || false
    const expired = Boolean(Array.isArray(params.expired) ? params.expired[0] : params.expired) || false
    const path = (Array.isArray(params.path) ? params.path[0] : params.path) || null

    return <LoginPage serverInternal={internal} path={path} serverExpired={expired} />
}
