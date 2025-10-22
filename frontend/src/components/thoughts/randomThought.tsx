import fetchRandomThought from '@/utils/thoughts/fetchRandomThought';

export default async function RandomThought() {
    const thought = await fetchRandomThought()
    if (!thought) {
        return
    }

    return (
        <div className='absolute top-20 self-center grid outline-1 outline-dark p-4 rounded-lg px-10 md:px-15'>
            <h1 className='text-sm text-almostbright'>Did you ever think about...</h1>
            <h1>{thought.title}</h1>
        </div>
    )
}
