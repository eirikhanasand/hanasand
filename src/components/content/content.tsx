import React from 'react'
import Image from "next/image"
// import QuoteButton from "../quoteButton"
import './content.css'

export default function Content() {
    return (
        <div className="relative grid grid-cols place-items-center h-full">
            <div className="relative w-48 h-48">
                <Image 
                    className="rounded-full object-cover"
                    src="/images/assets/selfie.jpeg" 
                    alt="logo"
                    fill
                    quality={100}
                />
            </div>
            <div className='absolute animate-bounce top-[90vh]'>
                <h1 className="eh animate-ping">eh?</h1>
            </div>
            {/* <h1 className="mt-2">Hello, I am Eirik Hanasand!</h1>
            <h1>I bought this domain 2 hours ago.. please have some patience : )</h1> */}
            {/* <h1>A frontend developer specialised in React Native</h1> */}
            {/* <QuoteButton /> */}
        </div>
    )
}
