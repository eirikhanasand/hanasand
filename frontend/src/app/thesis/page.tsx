import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import tokenIsValid from '@/utils/proxy/tokenIsValid'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import { canEditThesis, readThesis } from '@/utils/thesis'
import ThesisClient from './thesisClient'

export const metadata = { title: 'Thesis | Hanasand' }
export const dynamic = 'force-dynamic'

export default async function ThesisPage({ searchParams }: { searchParams: Promise<{ sheet?: string | string[] }> }) {
    const [{ sheet }, cookieStore] = await Promise.all([searchParams, cookies()])
    const redirectPath = '/content/thesis' + (typeof sheet === 'string' ? '?sheet=' + encodeURIComponent(sheet) : '')
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    if (!token || !id) redirect('/login?path=' + encodeURIComponent(redirectPath))
    const session = await tokenIsValid(token, id)
    if (session.state === 'invalid') redirect('/logout?path=' + encodeURIComponent('/login?path=' + redirectPath + '&expired=true'))
    if (!session.valid) throw new Error('Your session could not be checked. Please try again.')
    let member: boolean
    try { member = await isHanasandOrganizationMember(token, id) }
    catch { throw new Error('Hanasand organization membership could not be checked. Please try again.') }
    if (!member) redirect('/dashboard?notAllowed=true')
    const [document, canEdit] = await Promise.all([readThesis(token, id), canEditThesis(token, id)])
    return <ThesisClient initialDocument={document} canEdit={canEdit} />
}
