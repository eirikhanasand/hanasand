import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import tokenIsValid from '@/utils/proxy/tokenIsValid'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import { canEditThesis, readThesis } from '@/utils/thesis'
import ThesisClient from './thesisClient'

export const metadata = { title: 'Thesis | Hanasand' }
export const dynamic = 'force-dynamic'

export default async function ThesisPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    if (!token || !id) redirect('/login?path=%2Fcontent%2Fthesis')
    const session = await tokenIsValid(token, id)
    if (session.state === 'invalid') redirect('/logout?path=/login%3Fpath%3D/content/thesis%26expired=true')
    if (!session.valid) throw new Error('Your session could not be checked. Please try again.')
    let member: boolean
    try { member = await isHanasandOrganizationMember(token, id) }
    catch { throw new Error('Hanasand organization membership could not be checked. Please try again.') }
    if (!member) redirect('/dashboard?notAllowed=true')
    const [document, canEdit] = await Promise.all([readThesis(token, id), canEditThesis(token, id)])
    return <ThesisClient initialDocument={document} canEdit={canEdit} />
}
