import { cookies } from 'next/headers'
import { canEditThesis, readThesis } from '@/utils/thesis'
import ThesisClient from './thesisClient'

export const metadata = { title: 'Thesis | Hanasand' }
export const dynamic = 'force-dynamic'

export default async function ThesisPage() {
    const cookieStore = await cookies()
    const [document, canEdit] = await Promise.all([
        readThesis(),
        canEditThesis(cookieStore.get('access_token')?.value, cookieStore.get('id')?.value),
    ])
    return <ThesisClient initialDocument={document} canEdit={canEdit} />
}
