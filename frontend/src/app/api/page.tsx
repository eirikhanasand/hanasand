import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardLayout from '../dashboard/layout'
import ApiDocsPage from '../dashboard/api-docs/content'

export default async function ApiPage() {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) redirect('/logout?path=/login%3Fpath%3D/api%26expired=true')
    return <DashboardLayout><ApiDocsPage /></DashboardLayout>
}
