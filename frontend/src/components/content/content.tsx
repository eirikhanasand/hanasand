import React from 'react'
import ImageWithOverlay from '../images/imageWithOverlay'
import RandomThought from '../thoughts/randomThought'

export default function Content({ logout }: { logout: boolean }) {
    return (
        <div className='h-[93.5vh] relative grid grid-cols place-items-center'>
            {!logout && <RandomThought />}
            <ImageWithOverlay path='/about' image='/images/assets/selfie.jpeg' />
            <div className='absolute animate-bounce top-[90vh]'>
                <h1 className='eh animate-ping select-none'>eh?</h1>
            </div>
        </div>
    )
}
