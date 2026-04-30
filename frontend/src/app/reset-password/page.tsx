import ResetPasswordPage from './pageClient'

export default async function Page(props: { searchParams: Promise<{ id?: string, token?: string }> }) {
    const searchParams = await props.searchParams
    return <ResetPasswordPage userId={searchParams.id || ''} />
}
