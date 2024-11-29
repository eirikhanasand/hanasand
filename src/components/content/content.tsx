import selfie from "../assets/selfie.jpeg"
import React from 'react';
import './content.css';
import Image from "next/image";

export default function Content() {
    return (
        <div className="content bg-black">
            <Image 
                src={selfie as unknown as string} 
                className="w-[25vmin] h-[25vmin] rounded-full" 
                alt="logo"
            />
            <h1 className="mt-2">Hello, I am Eirik Hanasand!</h1>
            <h1>I bought this domain 2 hours ago.. please have some patience : )</h1>
            {/* <h1>A frontend developer specialised in React Native</h1> */}
        </div>
    )
}