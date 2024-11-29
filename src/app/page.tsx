import React from 'react'
import Link from 'next/link'
import Content from '@/components/content/content'

// Main component of the program, holds the main page and the user can navigate
// to different pages from here
export default async function Home() {

    // return (
    //     <div className="w-full h-full rounded-xl overflow-auto noscroll flex justify-center flex-col place-items-center">
    //         <div className="2xs:w-[80vw] xs:w-[50vw] sm:w-[35vw] h-[45vh] bg-dark rounded-xl p-8 overflow-auto mb-8 noscroll">
    //             <h1 className="text-xl text-center font-semibold mb-4">Select course</h1>
    //         </div>
    //         <Link href="/add/course" className='bg-dark h-[5vh] 2xs:w-[80vw] xs:w-[50vw] sm:w-[35vw] grid place-items-center rounded-xl px-8 text-xs md:text-lg'>Add course</Link>
    //     </div>
    // )

    return (
        <div className="App">
          <div>
            <Content />
          </div>
        </div>
    )
}
