import { Crown } from 'lucide-react'
import Link from 'next/link'

export default function DashboardRole({ role }: { role: Role }) {
    return (
        <Link href={`/roles/${role.id}`} className='flex p-2 hover:bg-dark rounded-lg hover:scale-[1.005] w-full justify-between'>
            <h1 key={role.id}>{role.name}</h1>
            <div className='flex gap-2'>
                {role.priority !== 0 && <h1>{role.priority}</h1>}
                {role.priority === 0 && <Crown className='stroke-amber-300 h-5 w-5' />}
            </div>
        </Link>
    )
}
