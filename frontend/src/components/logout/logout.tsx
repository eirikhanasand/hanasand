import { LogOut } from 'lucide-react'
import Link from 'next/link'

export default function Logout() {
    return (
        <Link href='/logout' className='rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
            <LogOut />
        </Link> 
    )
}
