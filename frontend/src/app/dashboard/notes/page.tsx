import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import NotesClient from './pageClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value

    if (!token) {
        redirect('/logout?path=/login%3Fpath%3D/dashboard/notes%26expired=true')
    }

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Content'
                title='Notes'
                description='Capture working notes and keep the latest context visible.'
            />
            <NotesClient />
        </DashboardPage>
    )
}
