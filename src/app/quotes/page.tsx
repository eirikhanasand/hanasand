import quotes from "./quotes.json"
import "./page.css"

function shuffleArray(array: string[]) {
    return [...array].sort(() => Math.random() - 0.5)
}

export default () => {
    const shuffledQuotes = shuffleArray(quotes)
    return (
        <div className="relative h-full w-full overflow-hidden bg-black">
            <div className="scrolling-quotes grid grid-cols-4">
                {shuffledQuotes.concat(shuffledQuotes).concat(shuffledQuotes).map((quote, index) => (
                    <div
                        key={index}
                        className="w-full text-center max-w-[160px] mx-auto text-gray-500 text-2xs"
                    >
                        <h1>{quote}</h1>
                    </div>
                ))}
            </div>
        </div>
    )
}
