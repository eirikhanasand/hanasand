import { ReactNode } from 'react'
import './globals.css'
import Navbar from '@components/nav'

export const metadata = {
    title: 'Eirik Hanasand',
    description: 'Portfolio',
}

export default function RootLayout({children}: {children: ReactNode}): JSX.Element {

    return (
        <html lang="en" className='h-[100vh] w-[100vw]'>
            <body>
                {children}
            </body>
        </html>
    )

    // return (
    //     <html lang="en" className='h-[100vh] w-[100vw]'>
    //         <body className='grid grid-rows-9 w-full h-full gap-8 p-8 noscroll'>
    //             <nav className='row-span-1 w-full rounded-xl overflow-auto'>
    //                 <Navbar />
    //             </nav>
    //             <main className='row-span-8 w-full rounded-xl max-h-full'>
    //                 {children}
    //             </main>
    //         </body>
    //     </html>
    // )
}
