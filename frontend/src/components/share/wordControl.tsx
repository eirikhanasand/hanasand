export default function WordControl({ clickedWord }: { clickedWord: string | null }) {
    if (!clickedWord) {
        return <></>
    }

    return (
        <div className='bg-light p-4 flex justify-between items-center shadow-md rounded-lg'>
            <h1>{clickedWord}</h1>
        </div>
    )
}
