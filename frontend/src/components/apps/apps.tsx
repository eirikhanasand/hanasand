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
            text: 'Activity follow-up, offline too',
            image: '/images/assets/iphone-events.png'
        },
        {
            text: 'App design experiments',
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
            <div className='grid place-items-center self-center p-8 font-semibold text-ui-muted'>
                <h1 className='max-w-[80vw] py-20 text-center md:py-10'>More soon.</h1>
            </div>
        </div>
    )
}

function AppView({text, image, reverse}: AppViewProps) {
    if (reverse) {
        return (
            <div className='grid md:grid-cols-2'>
                <div className='left_div grid place-items-center px-6 md:px-20'>
                    <p className='py-20 text-center text-5xl text-balance md:py-0 md:text-7xl'>{text}</p>
                </div>
                <AppImage image={image} />
            </div>
        )
    }

    return (
        <div className='flex md:grid flex-col-reverse md:grid-cols-2'>
            <AppImage image={image} />
            <div className='left_div grid place-items-center px-6 md:px-20'>
                <p className='py-20 text-center text-5xl text-balance md:py-0 md:text-7xl'>{text}</p>
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
                alt='Mobile application preview'
                quality={100}
            />
        </div>
    )
}
