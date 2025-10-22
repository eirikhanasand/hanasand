import Link from 'next/link'

export default function DashboardUser({ user }: { user: UserWithRole }) {
    return (
        <Link href={`/profile/${user.id}`} className='grid p-2 bg-dark rounded-lg hover:scale-[1.005]'>
            <h1 key={user.id}>{user.name}</h1>
        </Link>
    )
}
