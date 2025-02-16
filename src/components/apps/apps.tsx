import React from "react"
import './apps.css';
import Image from "next/image";

type AppViewProps = {
    text: string
    image: string
    reverse: boolean
}

export default function Apps() {
    const apps = [
        {
            text: "Follow up on activities, even when offline",
            image: "/images/assets/iphone-events.png"
        },
        {
            text: "Or explore potential designs for other apps",
            image: "/images/assets/pecubit.png"
        },
    ]
    
    return (
        <div className="grid grid-cols-2 bg-normal">
            {apps.map((app, index) => {
                return (
                    <AppView
                        key={index}
                        text={app.text}
                        image={app.image as unknown as string}
                        reverse={index % 2 === 0 ? true : false}
                    />
                )
            })}
        </div>
    )
}

function AppView({text, image, reverse}: AppViewProps) {
    if (reverse) {
        return (
            <>
                <div className="left_div grid place-items-center px-20">
                    <p className="text-center text-7xl text-balance">{text}</p>
                </div>
                <div className="grid place-items-center">
                    <Image
                        height={900}
                        width={450} 
                        src={image}
                        alt="React Native Event Management App" 
                        quality={100}
                    />
                </div>
            </>
        )
    } else {
        return (
            <>
                <div className="grid place-items-center">
                    <Image
                        height={900}
                        width={450} 
                        src={image}
                        alt="React Native Gambling App" 
                        quality={100}
                    />
                </div>
                <div className="left_div grid place-items-center px-20">
                    <p className="text-center text-7xl text-balance">{text}</p>
                </div>
            </>
        )
    }
}
