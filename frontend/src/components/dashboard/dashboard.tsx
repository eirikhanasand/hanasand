import { LayoutDashboard } from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
    return (
        <Link href='/dashboard' className='group rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center'>
            <LayoutDashboard className='stroke-current group-hover:stroke-[#374c66]' />
        </Link> 
    )
}
