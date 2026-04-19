import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import MailWorkspace from '@/components/mail/mailWorkspace'

export default async function Page(props: { searchParams: Promise<{ mailboxUser?: string }> }) {
    const searchParams = await props.searchParams
    const cookieStore = await cookies()
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/mail%26expired=true')
    }

    return <MailWorkspace mailboxUser={searchParams.mailboxUser || null} />
}
