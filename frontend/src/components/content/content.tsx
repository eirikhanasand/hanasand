import React from 'react'
import Image from "next/image"
import './content.css'
import Link from 'next/link'

export default function Content() {
    return (
        <div className="h-[93.5vh] relative grid grid-cols place-items-center">
            <Link href='/about' className="relative w-48 h-48 hover:scale-[1.03] cursor-pointer select-none">
                <Image 
                    className="rounded-full object-cover"
                    src="/images/assets/selfie.jpeg" 
                    alt="logo"
                    fill
                    quality={100}
                />
            </Link>
            <div className='absolute animate-bounce top-[90vh]'>
                <h1 className="eh animate-ping select-none">eh?</h1>
            </div>
        </div>
    )
}
