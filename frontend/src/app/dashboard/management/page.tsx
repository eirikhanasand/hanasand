import DashboardArticles from '@/components/articles/dashboardArticles'
import GreetingNav from '@/components/management/greetingNav'
import MobileNav from '@/components/management/mobileNav'
import Roles from '@/components/roles/roles'
import Thoughts from '@/components/thoughts/thoughts'
import Users from '@/components/users/users'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import getRoles from '@/utils/roles/getRoles'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value || ''
    if (!name || !id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const roles = await getRoles({ id, token })
    const text = timeBasedGreeting({ name })

    return (
        <div className='grid gap-5 py-4 md:py-8'>
            <section>
                <p className='text-xs uppercase tracking-[0.35em] text-orange-200/70'>Admin</p>
                <h1 className='mt-2 text-3xl font-semibold tracking-[-0.04em] text-bright'>Management</h1>
                <GreetingNav text={text} id={id} />
                <MobileNav id={id} />
            </section>
            <div className='grid gap-3 xl:grid-cols-2 xl:items-start'>
                <DashboardArticles />
                <Thoughts />
                <Users roles={roles} />
                <Roles roles={roles} />
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
