'use client'

export default function Sidebar() {
    return (
        <div className="hidden sidebar absolute grid grid-rows-9 left-0 top-0 h-full w-[200px] bg-dark">
            <div className="grid grid-cols-2 grid-rows-2 place-items-center pt-7">
                <div/>
                <SidebarButton />
            </div>
        </div>
    )
}

export function SidebarButton() {
    function handleClick() {
        const sidebar = document.querySelector('.sidebar')
        if (sidebar) {
            sidebar.classList.toggle('block')
            sidebar.classList.toggle('hidden')
        }
    }

    return (
        <button className="z-200" onClick={handleClick}>
            <Burger />
        </button>
    )
}

function Burger() {
    return (
        <div className='md:hidden w-[50px] h-[45px] grid grid-rows-3 gap-2 p-2 self-center'>
            <div className='bg-white rounded-xl h-[3px] self-center' />
            <div className='bg-white rounded-xl h-[3px] self-center' />
            <div className='bg-white rounded-xl h-[3px] self-center' />
        </div>
    )
}