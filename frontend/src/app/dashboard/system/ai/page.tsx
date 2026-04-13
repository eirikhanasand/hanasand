import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/system/ai%26expired=true')
    }

    return redirect('/ai')
}
