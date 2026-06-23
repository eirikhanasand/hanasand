import RegisterPage from './pageClient'

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
