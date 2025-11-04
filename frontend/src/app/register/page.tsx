import RegisterPage from './pageClient'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const internal = Array.isArray(params.internal) ? params.internal[0] : params.internal
    const path = Array.isArray(params.path) ? params.path[0] : params.path

    return <RegisterPage
        serverInternal={Boolean(internal) ?? false}
        path={path || null}
    />
}
