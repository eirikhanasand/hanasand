import generateRandomId from '@/utils/id/random'
import { redirect } from 'next/navigation'

export default function ShareRedirectPage() {
    const randomId = generateRandomId()
    redirect(`/s/${randomId}`)
}
