import DashboardArticles from '@/components/articles/dashboardArticles'
import Roles from '@/components/roles/roles'
import Thoughts from '@/components/thoughts/thoughts'
import Users from '@/components/users/users'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const id = Cookies.get('id')?.value

    if (!name || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const text = timeBasedGreeting({ name })

    return (
        <div className='h-full'>
            <div className='px-32 py-8 grid gap-2'>
                <div className='flex w-full rounded-lg justify-between items-center'>
                    <h1 className='text-2xl font-semibold flex-1'>{text}</h1>
                    <div className='grid h-fit w-fit px-2 py-1 outline-1 outline-dark rounded-lg gap-2'>
                        <Link href={`/profile/${id}`} className='flex justify-between px-10 group cursor-pointer items-center'>
                            <div className='user-icon' />
                            <h1 className='font-semibold text-base self-center'>Profile</h1>
                        </Link>
                    </div>
                </div>
                <div className='grid md:grid-cols-2 gap-2'>
                    <DashboardArticles />
                    <Thoughts />
                    <Users />
                    <Roles />
                </div>
            </div>
        </div>
    )
}

function timeBasedGreeting({ name }: { name: string }) {
    const now = new Date()
    const hour = now.getHours()

    if (hour >= 1 && hour < 5) {
        return `You're up late ${name}! Remember that you’re far more productive when rested.`
    } else if (hour >= 5 && hour < 8) {
        return `Good early morning ${name}! Ready to start the day?`
    } else if (hour >= 8 && hour < 12) {
        return `Good morning ${name}! Hope your day’s off to a great start.`
    } else if (hour >= 12 && hour < 14) {
        return `Good day ${name}! Time for a lunch break?`
    } else if (hour >= 14 && hour < 17) {
        return `Good afternoon ${name}! Keep up the good work.`
    } else if (hour >= 17 && hour < 20) {
        return `Good evening ${name}! How was your day?`
    } else if (hour >= 20 && hour < 23) {
        return `Good night ${name}! Time to unwind.`
    } else {
        return `It’s getting late ${name}, don’t forget to rest!`
    }
}
