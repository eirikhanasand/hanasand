import React from 'react'
import ImageWithOverlay from '../images/imageWithOverlay'

export default function Content() {
    return (
        <div className='h-[93.5vh] relative grid grid-cols place-items-center'>
            <ImageWithOverlay image='/images/assets/selfie.jpeg' />
            <div className='absolute animate-bounce top-[90vh]'>
                <h1 className='eh animate-ping select-none'>eh?</h1>
            </div>
        </div>
    )
}
