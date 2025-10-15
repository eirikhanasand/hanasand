export default function Or({ className }: { className?: string }) {
    return (
        <div className={`flex gap-2 ${className}`}>
            <h1 className='text-extralight'>────</h1>
            <h1>or</h1>
            <h1 className='text-extralight'>────</h1>
        </div>
    )
}
