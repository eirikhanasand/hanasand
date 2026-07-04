import fetchRandomThought from '@/utils/thoughts/fetchRandomThought'

export default async function RandomThought() {
    const thought = await fetchRandomThought()
    if (!thought) {
        return
    }

    return (
        <div className='absolute top-20 grid self-center rounded-lg border border-ui-border bg-ui-panel p-4 px-10 text-ui-text shadow-sm md:px-15'>
            <h1 className='text-sm text-ui-muted'>Did you ever think about...</h1>
            <h1>{thought.title}</h1>
        </div>
    )
}
