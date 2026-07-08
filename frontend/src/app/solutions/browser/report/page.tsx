import { redirect } from 'next/navigation'

export default async function BrowserReportPage(props: { searchParams: Promise<{ run?: string; token?: string }> }) {
    const searchParams = await props.searchParams
    const params = new URLSearchParams()
    if (searchParams.run) params.set('run', searchParams.run)
    if (searchParams.token) params.set('token', searchParams.token)
    redirect(`/browser/report${params.size ? `?${params}` : ''}`)
}
