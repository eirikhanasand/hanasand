import Link from 'next/link'

export default function DashboardRole({ role }: { role: Role }) {
    return (
        <Link href={`/roles/${role.id}`} className='grid p-2 bg-dark rounded-lg hover:scale-[1.005]'>
            <h1 key={role.id}>{role.name}</h1>
        </Link>
    )
}
