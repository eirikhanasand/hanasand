import quotes from './quotes.json'
import './page.css'

export default function page() {
    const shuffledQuotes = shuffleArray(Array.isArray(quotes) ? quotes : [])

    return (
        <div className='relative max-h-[90.5vh] w-full overflow-hidden bg-black'>
            <div className='scrolling-quotes grid md:grid-cols-4'>
                {shuffledQuotes.concat(shuffledQuotes).concat(shuffledQuotes).map((quote, index) => (
                    <div
                        key={index}
                        className='mx-auto w-full max-w-40 text-center text-2xs text-gray-500'
                    >
                        <h1>{quote}</h1>
                    </div>
                ))}
            </div>
        </div>
    )
}

function shuffleArray(array: string[]) {
    return [...array].sort(() => Math.random() - 0.5)
}
