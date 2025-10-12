import React from 'react'
import Image from "next/image"
// import QuoteButton from "../quoteButton"
import './content.css'
import Link from 'next/link'

export default function Content() {
    return (
        <div className="h-[100vh] relative grid grid-cols place-items-center">
            <Link href='/about' className="relative w-48 h-48 hover:scale-[1.03]">
                <Image 
                    className="rounded-full object-cover"
                    src="/images/assets/selfie.jpeg" 
                    alt="logo"
                    fill
                    quality={100}
                />
            </Link>
            <div className='absolute animate-bounce top-[96vh]'>
                <h1 className="eh animate-ping">eh?</h1>
            </div>
            {/* <h1 className="mt-2">Hello, I am Eirik Hanasand!</h1>
            <h1>I bought this domain 2 hours ago.. please have some patience : )</h1> */}
            {/* <h1>A frontend developer specialised in React Native</h1> */}
            {/* <QuoteButton /> */}
        </div>
    )
}
