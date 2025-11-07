import { Dispatch, SetStateAction } from 'react'

type DeployProps = {
    setOpen: Dispatch<SetStateAction<boolean>>
    deploying: boolean
    setDeploying: Dispatch<SetStateAction<boolean>>
}

export default function Deploy({ setOpen, deploying, setDeploying }: DeployProps) {
    return (
        <div
            onClick={() => { setOpen(true); setDeploying(true) }}
            className="
                group fixed bottom-3 right-3 z-100 cursor-pointer select-none
                w-[18.5%] min-w-[130px] py-2 rounded-xl text-center
                hover:shadow-[0_0_10px_rgba(0,0,0,0.3)] duration-300
                backdrop-blur-md bg-white/3 group-hover:bg-white/10 overflow-hidden
                hover:scale-[1.03] hover:border-white/30 transition-all
                shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_8px_rgba(0,0,0,0.4)]
            "
        >
            {/* Animated gradient light shimmer */}
            <div className="absolute inset-0 animate-gradient-fast bg-size-[200%_200%]
        bg-linear-to-r from-purple-500 via-red-400 to-orange-400 opacity-0 group-hover:opacity-50 blur-md" />

            {/* Glass overlay */}
            <div className="absolute inset-0 bg-black/10" />

            <h1 className="relative z-10 text-white/90 font-semibold tracking-wide">
                🚀 {deploying ? 'Deploying...' : 'Deploy'}
            </h1>
        </div>
    )
}
