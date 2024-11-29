'use client'

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

// Displays the login icon or the profile icon depending on the login status
export function RightIcon() {
    const [href, setHref] = useState('/login')
    const [icon, setIcon] = useState("/images/login.svg")

    return (
        <Link href={href} className='grid place-self-center w-[4vh] h-[4vh] relative'>
            <Image src={icon} alt="logo" fill={true} />
        </Link>
    )
}

// Displays the register icon or the logout icon depending on the login status
export function MiddleIcon() {
    const [href, setHref] = useState('/register')
    const [icon, setIcon] = useState("/images/join.svg")

    return (
        <Link href={href} className='grid place-self-center w-[4vh] h-[4vh] relative' onClick={() => {}}>
            <Image src={icon} alt="logo" fill={true} />
        </Link>
    )
}

// Displays the scoreboard icon
export function LeftIcon() {
    const href = "/scoreboard"
    const icon = "/images/scoreboard.svg"

    return (
        <Link href={href} className='grid place-self-center w-[3.5vh] h-[3.5vh] relative'>
            <Image src={icon} alt="logo" fill={true} />
        </Link>
    )
}
