type ArticleProps = {
    title: string
    description: string
    meta: string
}

export default function Featured() {
    const images = [
        {
            title: 'Library Safety Manager',
            image: '/images/assets/abstract.jpg',
            description: 'Package malware checks for Artifactory flows.',
            meta: 'Security tooling'
        },
        {
            title: 'React Native Event Management Application',
            image: '/images/assets/art.jpg',
            description: 'A mobile-first event workflow for planning, scanning, and managing attendees.',
            meta: 'Mobile application'
        },
        {
            title: 'Discord Bot for organization and IaC management',
            image: '/images/assets/city.jpg',
            description: 'Operational chat commands for organization, infrastructure, and deployment routines.',
            meta: 'Automation'
        }
    ]

    return (
        <div className='p-4 md:p-16'>
            <h1 className='text-foreground text-2xl'>Featured Projects</h1>
            <div className='grid md:grid-rows-2 md:grid-cols-2 gap-8 place-items-center mt-4'>
                {images.map((image) => <Project
                    key={image.title}
                    title={image.title}
                    description={image.description}
                    meta={image.meta}
                />)}
            </div>
        </div>
    )
}

function Project({ title, description, meta }: ArticleProps) {
    return (
        <article className='h-full w-full rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-foreground transition-colors hover:bg-white/[0.055]'>
            <div className='grid gap-3'>
                <p className='w-fit rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-bright/45'>{meta}</p>
                <h2 className='text-lg font-semibold text-bright/90'>{title}</h2>
                <p className='text-sm leading-6 text-bright/58'>{description}</p>
            </div>
        </article>
    )
}
