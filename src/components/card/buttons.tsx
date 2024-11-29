type ButtonsProps = {
    animateAnswer: string
    navigate: (direction: string) => void
    flashColor: string
}

export default function Buttons({animateAnswer, navigate, flashColor}: ButtonsProps) {
    const button = `text-xl rounded-xl grid place-items-center`

    return (
        <div className="w-full rounded-xl grid grid-cols-3 gap-8">
            <button 
                className={`${button} ${animateAnswer === 'back' ? "bg-light" : "bg-dark"}`}
                onClick={() => navigate('back')}
            >
                back
            </button>
            <button 
                className={`${button} ${animateAnswer === 'skip' ? "bg-light" : "bg-dark"}`}
                onClick={() => navigate('skip')}
            >
                skip
            </button>
            <button 
                className={`${button} ${flashColor}`}
                onClick={() => navigate('next')}
            >
                next
            </button>
        </div>
    )
}
