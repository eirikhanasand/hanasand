import React from 'react'
import './apps.css'
import Image from 'next/image'

type AppViewProps = {
    text: string
    image: string
    reverse: boolean
}

export default function Apps() {
    const apps = [
        {
            text: 'Follow up on activities, even when offline',
            image: '/images/assets/iphone-events.png'
        },
        {
            text: 'Or explore potential designs for other apps',
            image: '/images/assets/pecubit.png'
        },
    ]
    
    return (
        <div className='grid'>
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
            <div className='text-gray-500 grid place-items-center p-8 font-semibold self-center'>
                <h1 className='max-w-[80vw] py-50 md:py-10 text-center'>more content coming soon &lt;3 if only there were 48 hours in a day...</h1>
            </div>
        </div>
    )
}

function AppView({text, image, reverse}: AppViewProps) {
    if (reverse) {
        return (
            <div className='grid md:grid-cols-2'>
                <div className='left_div grid place-items-center px-20'>
                    <p className='text-center text-5xl py-50 md:py-0 md:text-7xl text-balance'>{text}</p>
                </div>
                <AppImage image={image} />
            </div>
        )
    } 
    
    return (
        <div className='flex md:grid flex-col-reverse md:grid-cols-2'>
            <AppImage image={image} />
            <div className='left_div grid place-items-center px-20'>
                <p className='text-center py-50 md:py-0 text-5xl md:text-7xl text-balance'>{text}</p>
            </div>
        </div>
    )
}

function AppImage({image}: {image: string}) {
    return (
        <div className='grid place-items-center'>
            <Image
                height={900}
                width={450} 
                src={image}
                alt='React Native Gambling App' 
                quality={100}
            />
        </div>
    )
}
