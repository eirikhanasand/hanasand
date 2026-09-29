import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { loadThesisForRender } from '@/utils/thesis'
import ThesisClient from './thesisClient'

export const metadata = { title: 'Thesis | Hanasand' }
export const dynamic = 'force-dynamic'

export default async function ThesisPage({ searchParams }: { searchParams: Promise<{ sheet?: string | string[] }> }) {
    const [{ sheet }, cookieStore] = await Promise.all([searchParams, cookies()])
    const redirectPath = '/content/thesis' + (typeof sheet === 'string' ? '?sheet=' + encodeURIComponent(sheet) : '')
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    if (!token || !id) redirect('/login?path=' + encodeURIComponent(redirectPath))
    const result = await loadThesisForRender(token, id)
    if (result.state === 'invalid-session') redirect('/logout?path=' + encodeURIComponent('/login?path=' + redirectPath + '&expired=true'))
    if (result.state === 'not-member') redirect('/dashboard?notAllowed=true')
    return <ThesisClient initialDocument={result.document} canEdit={result.canEdit} />
}
