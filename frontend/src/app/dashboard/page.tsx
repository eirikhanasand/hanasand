import DashboardArticle from '@/components/articles/dashboardArticle'
import fetchArticles from '@/utils/articles/fetchArticles'
import { Plus } from 'lucide-react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const articles = await fetchArticles()
    
    if (!name) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const text = timeBasedGreeting({name})

    return (
        <div className='h-full'>
            <div className='p-16 grid gap-2'>
                <div className='grid w-full p-2 rounded-lg'>
                    <h1 className='text-2xl font-semibold'>{text}</h1>
                </div>
                <div className='grid w-full p-2 bg-dark rounded-lg gap-2'>
                    <div className='flex justify-between'>
                        <h1 className='font-semibold text-lg'>Articles</h1>
                        <Link href='/dashboard/articles/create' className='flex gap-2 rounded-lg p-2 px-6 bg-light cursor-pointer hover:bg-green-500'>
                            <Plus />
                            <h1 className='font-semibold'>Create</h1>
                        </Link>
                    </div>
                    {(articles as Article[]).map((article) => <DashboardArticle key={article.id} article={article} />)}
                </div>
            </div>
        </div>
    )
}

function timeBasedGreeting({ name }: { name: string }) {
    const now = new Date();
    const hour = now.getHours();

    if (hour >= 0 && hour < 5) {
        return `You're up late ${name}! Hope everything's okay.`;
    } else if (hour >= 5 && hour < 8) {
        return `Good early morning ${name}! Ready to start the day?`;
    } else if (hour >= 8 && hour < 12) {
        return `Good morning ${name}! Hope your day’s off to a great start.`;
    } else if (hour >= 12 && hour < 14) {
        return `Good day ${name}! Time for a lunch break?`;
    } else if (hour >= 14 && hour < 17) {
        return `Good afternoon ${name}! Keep up the good work.`;
    } else if (hour >= 17 && hour < 20) {
        return `Good evening ${name}! How was your day?`;
    } else if (hour >= 20 && hour < 23) {
        return `Good night ${name}! Time to unwind.`;
    } else {
        return `It’s getting late ${name}, don’t forget to rest!`;
    }
}
