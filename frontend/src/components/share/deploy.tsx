import { Dispatch, SetStateAction } from 'react'

type DeployProps = {
    setTerminalOpen: Dispatch<SetStateAction<boolean>>
    terminalOpen: boolean
}

export default function Deploy({ setTerminalOpen, terminalOpen }: DeployProps) {
    return (
        <button
            type='button'
            aria-label={terminalOpen ? 'Terminal open for deployment commands' : 'Open terminal for deployment commands'}
            onClick={() => setTerminalOpen(true)}
            className='
                group fixed bottom-3 right-3 z-100 cursor-pointer select-none
                w-[18.5%] min-w-[130px] rounded-xl px-4 py-2 text-center
                hover:shadow-[0_0_10px_rgba(0,0,0,0.3)] duration-300
                backdrop-blur-md bg-white/3 group-hover:bg-white/10 overflow-hidden
                hover:scale-[1.03] hover:border-white/30 transition-all
                shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_8px_rgba(0,0,0,0.4)]
            '
        >
            {/* Animated gradient light shimmer */}
            <div className='absolute inset-0 animate-gradient-fast bg-size-[200%_200%]
        bg-linear-to-r from-purple-500 via-red-400 to-orange-400 opacity-0 group-hover:opacity-50 blur-md' />

            {/* Glass overlay */}
            <div className='absolute inset-0 bg-black/10' />

            <h1 className='relative z-10 text-white/90 font-semibold tracking-wide'>
                Deploy
            </h1>
        </button>
    )
}
