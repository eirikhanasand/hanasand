'use client'

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export default function UserInfo() {
    const [user, setUser] = useState<LoggedInUser>({ name: 'Loading...', username: "Loading...", time: 0 })
    const [edit, setEdit] = useState('')
    const path = usePathname()
    const timeAsHumanReadable = user.time !== 0 ? `${(user.time / 60).toFixed(0)}min ${user.time % 60}s` : ''

    const [left, setLeft] = useState('')
    const [middle, setMiddle] = useState('')
    const [right, setRight] = useState('')

    return (
        <div className='hidden xs:grid grid-cols-1 sm:grid-cols-3 w-full sm:bg-dark rounded-xl items-center'>
            <h1 className='hidden md:grid place-items-center text-xl text-bright'>{left}</h1>
            <h1 className='hidden sm:grid absolute left-1/2 transform -translate-x-1/2 text-xl self-center pt-2'>{middle}</h1>
            {/* ghost div since middle is absolute to act as the middle grid column */}
            <div/>
            <h1 className='hidden lg:grid place-items-center text-xl text-bright'>{right}</h1>
        </div>
    )
}
