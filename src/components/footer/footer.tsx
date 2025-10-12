export default function Footer() {
    return (
        <footer className='w-full h-[150px]'>
            <section className='w-full h-full grid place-items-center'>
                <h1>© hanasand.com · 2024 - {new Date().getFullYear()}</h1>
            </section>
        </footer>
    )
}
