import React from "react"
import Login from "../assets/iphone-events.png"
import Pecubit from "../assets/pecubit.png"
import './apps.css';

type AppViewProps = {
    text: string
    image: string
    reverse: boolean
}

export default function Apps() {
    const apps = [
        {
            text: "Follow up on activities, even when offline",
            image: Login
        },
        {
            text: "Or explore potential designs for other apps",
            image: Pecubit
        },
    ]

    return (
        <div className="outline">
            {apps.map((app, index) => {
                return (
                    <AppView 
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
                <div className="left_div">
                    <p className="browse">{text}</p>
                </div>
                <div className="right_div">
                    <img
                        width={450} 
                        src={image}
                        alt="Logo" 
                    />
                </div>
            </>
        )
    } else {
        return (
            <>
                <div className="right_div">
                    <img
                        width={450} 
                        src={image}
                        alt="Logo" 
                    />
                </div>
                <div className="left_div">
                    <p className="browse">{text}</p>
                </div>
            </>
        )
    }
}