import LogoutPageClient from './pageClient'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const path = Array.isArray(params.path) ? params.path[0] : params.path

    // @ts-expect-error Complains that the type is incorrect, but its not
    // supposed to return anything since it is a JSX element responsible for
    // redirecting to another JSX element after logging out the user.
    return <LogoutPageClient path={path} />
}
