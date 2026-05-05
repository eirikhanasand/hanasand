import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value

    if (!id) {
        redirect('/logout?path=/login%3Fpath%3D/profile%26expired=true')
    }

    redirect(`/profile/${id}`)
}
