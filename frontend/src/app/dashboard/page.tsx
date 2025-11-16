import GreetingNav from '@/components/dashboard/greetings/greetingNav'
import GreetingNavButtons from '@/components/dashboard/greetings/greetingNavButtons'
import VMs from '@/components/profile/vms'
import Projects from '@/components/projects/projects'
import Shares from '@/components/share/dashboard/projects'
import getVMs from '@/utils/vms/getVMs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const id = Cookies.get('id')?.value

    if (!name || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const text = timeBasedGreeting({ name })
    const vms = await getVMs(id)

    return (
        <div className='h-full w-full'>
            <div className='px-8 md:px-16 lg:px-32 py-4 md:py-8 grid gap-2 w-full'>
                <GreetingNav text={text} id={id} />
                <GreetingNavButtons id={id} />
                <div className='grid md:grid-cols-2 gap-2'>
                    <Projects />
                    <Shares />
                    <VMs vms={vms} />
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
