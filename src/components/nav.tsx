import Image from 'next/image'
import Link from 'next/link'
import { RightIcon, MiddleIcon, LeftIcon } from './clientNav'
import UserInfo from './userInfo'
import Sidebar, { SidebarButton } from './sidebar'

// Displays the header
export default function Navbar() {

    return (
        <div className='flex w-full gap-4 overflow-hidden'>
            <Sidebar />
            {/* logo */}
            <div className='pl-2 flex gap-2 mx-auto'>
                <Link href='/' className='grid w-[4vh] h-[4vh] relative self-center'>
                    <Image src={"/images/logo/logo.svg"} alt="logo" fill={true} />
                </Link>
                <SidebarButton />
            </div>
            {/* Info for the user */}
            <UserInfo />
            {/* account, login */}
            <div className='grid grid-cols-3 justify-between rounded-xl gap-2 min-w-[15vh]'>
                {/* Scoreboard */}
                <LeftIcon />
                {/* create account */}
                <MiddleIcon />
                {/* login */}
                <RightIcon />
            </div>
        </div>
    )
}
