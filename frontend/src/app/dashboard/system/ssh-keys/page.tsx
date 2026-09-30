import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
    const cookieStore = await cookies()
    const id = cookieStore.get('id')?.value
    if (!id || !cookieStore.get('access_token')?.value) {
        return redirect('/logout?path=/login%3Fpath%3D/system/ssh-keys%26expired=true')
    }
    return redirect(`/profile/${encodeURIComponent(id)}/ssh-keys`)
}
