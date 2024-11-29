'use client'

import { sendLogout } from "@utils/user"
import isLoggedIn from "@utils/user"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

// Displays the login icon or the profile icon depending on the login status
export function RightIcon() {
    const [href, setHref] = useState('/login')
    const [icon, setIcon] = useState("/images/login.svg")
    const loggedIn = isLoggedIn()

    useEffect(() => {
        if (loggedIn) {
            setHref(`/profile/${loggedIn}`)
            setIcon("/images/profile.svg")
        } else {
            setHref('/login')
            setIcon("/images/login.svg")
        }
    }, [loggedIn])

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
    const loggedIn = isLoggedIn()

    useEffect(() => {
        if (loggedIn) {
            setHref('/')
            setIcon("/images/logout.svg")
        } else {
            setHref('/register')
            setIcon("/images/join.svg")
        }
    }, [loggedIn])

    function handleClick() {
        if (loggedIn) {
            sendLogout()
        }
    }

    return (
        <Link href={href} className='grid place-self-center w-[4vh] h-[4vh] relative' onClick={handleClick}>
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
